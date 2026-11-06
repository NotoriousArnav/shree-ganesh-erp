import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "../db.js";
import {
  categories,
  merchants,
  products,
  stockMovements,
  stockMovementType,
} from "../db/schema.js";
import { requireRole } from "../http/auth-guard.js";

/**
 * Merchant-side inventory API.
 *
 * Every query is scoped by the merchant id on the session, never by a value in
 * the request. Platform roles cannot use these routes; they go through
 * /api/admin instead.
 */

type ScopedRequest = FastifyRequest & {
  authSession: NonNullable<FastifyRequest["authSession"]>;
};

function merchantIdOf(request: FastifyRequest) {
  return (request as ScopedRequest).authSession.user.merchantId!;
}

function parse<T>(schema: z.ZodType<T>, data: unknown, reply: FastifyReply) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    reply.code(400).send({ error: `${path}${issue?.message ?? "Invalid request"}` });
    return null;
  }
  return result.data;
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string } | null)?.code === "23505";
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "Not found" });
}

const optionalText = (max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    // Keep `undefined` as "not supplied" so PATCH does not wipe fields.
    .transform((value) => (value === undefined ? undefined : value ? value : null));

const money = z.coerce.number().min(0).max(10_000_000).default(0);
const quantity = z.coerce.number().min(0).max(10_000_000).default(0);

const units = [
  "pcs",
  "kg",
  "g",
  "litre",
  "ml",
  "box",
  "packet",
  "dozen",
  "bundle",
  "metre",
  "sqft",
] as const;

const productFields = {
  name: z.string().trim().min(1, "Name is required").max(160),
  categoryId: z.uuid().nullish(),
  sku: optionalText(64),
  barcode: optionalText(64),
  unit: z.enum(units).default("pcs"),
  hsnCode: optionalText(16),
  taxRate: z.coerce.number().min(0, "Tax rate cannot be negative").max(100).default(0),
  purchasePrice: money,
  sellingPrice: money,
  reorderLevel: quantity,
  attributes: z.record(z.string(), z.string()).nullish(),
};

const productCreateInput = z.object({
  ...productFields,
  /** Opening stock; recorded as an adjustment so history stays complete. */
  stockQty: quantity,
});

const productUpdateInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(160).optional(),
  categoryId: z.uuid().nullish(),
  sku: optionalText(64),
  barcode: optionalText(64),
  unit: z.enum(units).optional(),
  hsnCode: optionalText(16),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  purchasePrice: z.coerce.number().min(0).max(10_000_000).optional(),
  sellingPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  reorderLevel: z.coerce.number().min(0).max(10_000_000).optional(),
  attributes: z.record(z.string(), z.string()).nullish(),
  isActive: z.boolean().optional(),
});

const categoryInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  parentId: z.uuid().nullish(),
});

const stockInput = z
  .object({
    type: z.enum(stockMovementType.enumValues),
    /** Always positive; the movement type decides the sign. */
    quantity: z.coerce.number().positive("Quantity must be greater than zero").max(10_000_000),
    /** Required for `adjustment`, ignored otherwise. */
    direction: z.enum(["in", "out"]).optional(),
    unitCost: z.coerce.number().min(0).max(10_000_000).nullish(),
    note: optionalText(280),
  })
  .refine((value) => value.type !== "adjustment" || Boolean(value.direction), {
    message: "Direction is required for an adjustment",
    path: ["direction"],
  });

const inboundTypes = new Set(["purchase", "return_in", "transfer_in"]);
const outboundTypes = new Set(["sale", "return_out", "damage", "transfer_out"]);

function signedQuantity(input: z.infer<typeof stockInput>) {
  if (inboundTypes.has(input.type)) return input.quantity;
  if (outboundTypes.has(input.type)) return -input.quantity;
  return input.direction === "out" ? -input.quantity : input.quantity;
}

export async function registerMerchantRoutes(app: FastifyInstance) {
  const scoped = requireRole("merchant", "staff");
  // Staff can see stock and move it, but not change catalogue or prices.
  const owner = requireRole("merchant");

  app.get("/api/merchant/profile", { preHandler: scoped }, async (request) => {
    const merchantId = merchantIdOf(request);
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    return {
      merchant: merchant ?? null,
      user: {
        id: request.authSession!.user.id,
        name: request.authSession!.user.name,
        role: request.authSession!.user.role,
      },
    };
  });

  app.get("/api/merchant/dashboard", { preHandler: scoped }, async (request) => {
    const merchantId = merchantIdOf(request);

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    const [productStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${products.isActive})::int`,
        stockValue: sql<number>`coalesce(sum(${products.stockQty} * ${products.purchasePrice}), 0)::float8`,
        retailValue: sql<number>`coalesce(sum(${products.stockQty} * ${products.sellingPrice}), 0)::float8`,
      })
      .from(products)
      .where(eq(products.merchantId, merchantId));

    const [categoryStats] = await db
      .select({ total: count() })
      .from(categories)
      .where(eq(categories.merchantId, merchantId));

    const [lowStockStats] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(
        and(
          eq(products.merchantId, merchantId),
          eq(products.isActive, true),
          gte(products.reorderLevel, sql`0.001`),
          sql`${products.stockQty} <= ${products.reorderLevel}`,
        ),
      );

    const lowStock = await db
      .select({
        id: products.id,
        name: products.name,
        unit: products.unit,
        stockQty: products.stockQty,
        reorderLevel: products.reorderLevel,
      })
      .from(products)
      .where(
        and(
          eq(products.merchantId, merchantId),
          eq(products.isActive, true),
          gte(products.reorderLevel, sql`0.001`),
          sql`${products.stockQty} <= ${products.reorderLevel}`,
        ),
      )
      .orderBy(asc(products.stockQty), asc(products.name))
      .limit(8);

    const startOfDay = sql`date_trunc('day', now())`;

    const [today] = await db
      .select({
        movements: sql<number>`count(*)::int`,
        inQty: sql<number>`coalesce(sum(case when ${stockMovements.quantity} > 0 then ${stockMovements.quantity} else 0 end), 0)::float8`,
        outQty: sql<number>`coalesce(sum(case when ${stockMovements.quantity} < 0 then -${stockMovements.quantity} else 0 end), 0)::float8`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.merchantId, merchantId),
          gte(stockMovements.createdAt, startOfDay),
        ),
      );

    const recentMovements = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        unit: products.unit,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(eq(stockMovements.merchantId, merchantId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(8);

    return {
      merchant: merchant ?? null,
      counts: {
        products: productStats?.total ?? 0,
        activeProducts: productStats?.active ?? 0,
        categories: categoryStats?.total ?? 0,
        lowStock: lowStockStats?.total ?? 0,
      },
      value: {
        cost: productStats?.stockValue ?? 0,
        retail: productStats?.retailValue ?? 0,
        currency: merchant?.currency ?? "INR",
      },
      today: {
        movements: today?.movements ?? 0,
        inQty: today?.inQty ?? 0,
        outQty: today?.outQty ?? 0,
      },
      lowStock,
      recentMovements,
    };
  });

  // ---- Categories ---------------------------------------------------------

  app.get("/api/merchant/categories", { preHandler: scoped }, async (request) => {
    const merchantId = merchantIdOf(request);

    return db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
        productCount: sql<number>`count(${products.id})::int`,
      })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .where(eq(categories.merchantId, merchantId))
      .groupBy(categories.id)
      .orderBy(asc(categories.name));
  });

  app.post("/api/merchant/categories", { preHandler: owner }, async (request, reply) => {
    const merchantId = merchantIdOf(request);
    const input = parse(categoryInput, request.body, reply);
    if (!input) return;

    if (input.parentId) {
      const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.parentId), eq(categories.merchantId, merchantId)))
        .limit(1);
      if (!parent) return reply.code(400).send({ error: "Parent category not found" });
    }

    try {
      const [created] = await db
        .insert(categories)
        .values({
          merchantId,
          name: input.name,
          parentId: input.parentId ?? null,
        })
        .returning();

      return reply.code(201).send(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: "A category with that name already exists" });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/api/merchant/categories/:id",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(categoryInput.partial(), request.body, reply);
      if (!input) return;

      if (input.parentId) {
        if (input.parentId === request.params.id) {
          return reply.code(400).send({ error: "A category cannot be its own parent" });
        }
        const [parent] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.id, input.parentId), eq(categories.merchantId, merchantId)))
          .limit(1);
        if (!parent) return reply.code(400).send({ error: "Parent category not found" });
      }

      try {
        const [updated] = await db
          .update(categories)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.parentId !== undefined ? { parentId: input.parentId ?? null } : {}),
          })
          .where(and(eq(categories.id, request.params.id), eq(categories.merchantId, merchantId)))
          .returning();

        if (!updated) return notFound(reply);
        return updated;
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({ error: "A category with that name already exists" });
        }
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/merchant/categories/:id",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const [deleted] = await db
        .delete(categories)
        .where(and(eq(categories.id, request.params.id), eq(categories.merchantId, merchantId)))
        .returning({ id: categories.id });

      if (!deleted) return notFound(reply);
      return { id: deleted.id };
    },
  );

  // ---- Products -----------------------------------------------------------

  app.get("/api/merchant/products", { preHandler: scoped }, async (request) => {
    const merchantId = merchantIdOf(request);
    const query = request.query as {
      q?: string;
      categoryId?: string;
      lowStock?: string;
      includeInactive?: string;
    };

    const filters = [eq(products.merchantId, merchantId)];

    const search = query.q?.trim();
    if (search) {
      const pattern = `%${search}%`;
      filters.push(
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.barcode, pattern),
        )!,
      );
    }

    if (query.categoryId) {
      filters.push(eq(products.categoryId, query.categoryId));
    }

    if (query.lowStock === "true") {
      filters.push(
        gte(products.reorderLevel, sql`0.001`),
        sql`${products.stockQty} <= ${products.reorderLevel}`,
      );
    }

    if (query.includeInactive !== "true") {
      filters.push(eq(products.isActive, true));
    }

    return db
      .select({
        ...getTableColumns(products),
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(...filters))
      .orderBy(asc(products.name));
  });

  app.post("/api/merchant/products", { preHandler: owner }, async (request, reply) => {
    const merchantId = merchantIdOf(request);
    const input = parse(productCreateInput, request.body, reply);
    if (!input) return;

    if (input.categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.merchantId, merchantId)))
        .limit(1);
      if (!category) return reply.code(400).send({ error: "Category not found" });
    }

    try {
      const created = await db.transaction(async (tx) => {
        const [product] = await tx
          .insert(products)
          .values({
            merchantId,
            name: input.name,
            categoryId: input.categoryId ?? null,
            sku: input.sku,
            barcode: input.barcode,
            unit: input.unit,
            hsnCode: input.hsnCode,
            taxRate: input.taxRate,
            purchasePrice: input.purchasePrice,
            sellingPrice: input.sellingPrice,
            reorderLevel: input.reorderLevel,
            attributes: input.attributes ?? null,
            stockQty: input.stockQty,
          })
          .returning();

        if (input.stockQty > 0) {
          await tx.insert(stockMovements).values({
            merchantId,
            productId: product.id,
            type: "adjustment",
            quantity: input.stockQty,
            unitCost: input.purchasePrice || null,
            note: "Opening stock",
          });
        }

        return product;
      });

      return reply.code(201).send(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply
          .code(409)
          .send({ error: "That SKU or barcode is already used by another product" });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/api/merchant/products/:id",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(productUpdateInput, request.body, reply);
      if (!input) return;

      if (input.categoryId) {
        const [category] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.id, input.categoryId), eq(categories.merchantId, merchantId)))
          .limit(1);
        if (!category) return reply.code(400).send({ error: "Category not found" });
      }

      const patch = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: "No changes supplied" });
      }

      try {
        const [updated] = await db
          .update(products)
          .set(patch)
          .where(and(eq(products.id, request.params.id), eq(products.merchantId, merchantId)))
          .returning();

        if (!updated) return notFound(reply);
        return updated;
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply
            .code(409)
            .send({ error: "That SKU or barcode is already used by another product" });
        }
        throw error;
      }
    },
  );

  /** Archives a product. Stock history is kept, so this is not a hard delete. */
  app.delete<{ Params: { id: string } }>(
    "/api/merchant/products/:id",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const [archived] = await db
        .update(products)
        .set({ isActive: false })
        .where(and(eq(products.id, request.params.id), eq(products.merchantId, merchantId)))
        .returning({ id: products.id });

      if (!archived) return notFound(reply);
      return { id: archived.id, isActive: false };
    },
  );

  // ---- Stock --------------------------------------------------------------

  app.post<{ Params: { id: string } }>(
    "/api/merchant/products/:id/stock",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(stockInput, request.body, reply);
      if (!input) return;

      const signed = signedQuantity(input);

      try {
        const result = await db.transaction(async (tx) => {
          const [product] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, request.params.id), eq(products.merchantId, merchantId)))
            .for("update")
            .limit(1);

          if (!product) return null;

          if (!product.isActive) {
            throw new StockError("This product is archived. Restore it before moving stock.");
          }

          const nextQty = product.stockQty + signed;
          if (nextQty < 0) {
            throw new StockError(
              `Only ${product.stockQty} ${product.unit} in stock, cannot remove ${input.quantity}`,
            );
          }

          const [updated] = await tx
            .update(products)
            .set({ stockQty: nextQty })
            .where(eq(products.id, product.id))
            .returning();

          const [movement] = await tx
            .insert(stockMovements)
            .values({
              merchantId,
              productId: product.id,
              type: input.type,
              quantity: signed,
              unitCost: input.unitCost ?? null,
              note: input.note,
            })
            .returning();

          return { product: updated, movement };
        });

        if (!result) return notFound(reply);
        return result;
      } catch (error) {
        if (error instanceof StockError) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/merchant/products/:id/movements",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const [product] = await db
        .select({ id: products.id, name: products.name, unit: products.unit })
        .from(products)
        .where(and(eq(products.id, request.params.id), eq(products.merchantId, merchantId)))
        .limit(1);

      if (!product) return notFound(reply);

      const movements = await db
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.productId, product.id),
            eq(stockMovements.merchantId, merchantId),
          ),
        )
        .orderBy(desc(stockMovements.createdAt))
        .limit(100);

      return { product, movements };
    },
  );

  app.get("/api/merchant/movements", { preHandler: scoped }, async (request) => {
    const merchantId = merchantIdOf(request);
    const query = request.query as { limit?: string };
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);

    return db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        unit: products.unit,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        unitCost: stockMovements.unitCost,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(eq(stockMovements.merchantId, merchantId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);
  });
}

class StockError extends Error {}
