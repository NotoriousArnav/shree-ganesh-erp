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
import { requireMerchant, requireMerchantOwner, requirePermission, can } from "../http/auth-guard.js";
import {
  isUniqueViolation,
  uniqueConstraint,
} from "../http/pg-errors.js";

/**
 * Merchant-side inventory API.
 *
 * Every query is scoped by the merchant id on the session, never by a value in
 * the request. Platform roles cannot use these routes; they go through
 * /api/admin instead.
 */

function merchantIdOf(request: FastifyRequest) {
  return request.merchantAccess!.merchantId;
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

/** Names the field that actually clashed instead of blaming both. */
function uniqueViolationMessage(error: unknown) {
  const constraint = uniqueConstraint(error);

  if (constraint === "products_merchant_sku_idx") {
    return "That SKU is already used by another product";
  }

  if (constraint === "products_merchant_barcode_idx") {
    return "That barcode is already used by another product";
  }

  return "That SKU or barcode is already used by another product";
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "Not found" });
}

/**
 * Resolves a free-text category name for the product form.
 *
 * An existing name is always reused, so a catalogue-only staff member can
 * still file a product under a category the merchant already made. Creating a
 * new category needs the categories permission; when it is missing the caller
 * gets `denied: true` instead of a silent side effect.
 */
async function resolveCategoryName(
  merchantId: string,
  rawName: string,
  allowCreate: boolean,
): Promise<{ id: string | null; denied: boolean }> {
  const name = rawName.trim();
  if (!name) return { id: null, denied: false };

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.merchantId, merchantId),
        sql`lower(${categories.name}) = lower(${name})`,
      ),
    )
    .limit(1);

  if (existing) return { id: existing.id, denied: false };
  if (!allowCreate) return { id: null, denied: true };

  const [created] = await db
    .insert(categories)
    .values({ merchantId, name })
    .onConflictDoNothing({ target: [categories.merchantId, categories.name] })
    .returning({ id: categories.id });

  if (created) return { id: created.id, denied: false };

  // Lost a race with another insert; read it back.
  const [fallback] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.merchantId, merchantId), eq(categories.name, name)),
    )
    .limit(1);

  return { id: fallback?.id ?? null, denied: false };
}

/**
 * Builds a readable SKU from the product name.
 *
 * "Basmati Rice 5 kg" becomes "BASMATI-RICE-5". Not derived from the barcode:
 * many items (loose grain, flowers, books) have no barcode at all.
 */
function skuBase(name: string) {
  const words = name
    // \p{M} keeps Indic vowel signs, so "दूध" does not break into "द ध".
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  const base = words.join("-").slice(0, 24).replace(/-+$/, "");
  return base || "ITEM";
}

/** Picks the first free SKU for this merchant, e.g. RICE-5, RICE-5-2. */
async function generateSku(merchantId: string, name: string) {
  const base = skuBase(name);

  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const [taken] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.merchantId, merchantId), eq(products.sku, candidate)))
      .limit(1);

    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36).toUpperCase()}`;
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
  /** Free-text category; created on save when it does not exist yet. */
  categoryName: optionalText(80),
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
  /** Free-text category; an empty value clears the category. */
  categoryName: optionalText(80),
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
  // Reading products, categories and the dashboard is open to all shop users.
  const scoped = requireMerchant();
  // Staff permissions are checked per action; merchants always pass.
  const owner = requirePermission("catalogue");
  const categoryEditor = requirePermission("categories");
  const stockMover = requirePermission("stock");
  // The shop owner themselves can edit the shop profile.
  const ownerSelf = requireMerchantOwner();

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
        role: request.merchantAccess!.role,
        permissions: request.merchantAccess!.permissions,
      },
    };
  });

  app.patch("/api/merchant/profile", { preHandler: ownerSelf }, async (request, reply) => {
    const merchantId = merchantIdOf(request);
    const input = parse(
      z.object({
        name: z.string().trim().min(1, "Name is required").max(120).optional(),
        phone: z.string().trim().max(24).nullish(),
        gstin: z.string().trim().max(20).nullish(),
        currency: z.string().trim().max(8).optional(),
        address: z.record(z.string(), z.string()).nullish(),
      }),
      request.body,
      reply,
    );
    if (!input) return;

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.gstin !== undefined) patch.gstin = input.gstin;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.address !== undefined) patch.address = input.address;

    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: "No changes supplied" });
    }

    const [updated] = await db
      .update(merchants)
      .set(patch)
      .where(eq(merchants.id, merchantId))
      .returning();

    if (!updated) return reply.code(404).send({ error: "Merchant not found" });

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    return {
      merchant: merchant ?? updated,
      user: {
        id: request.authSession!.user.id,
        name: request.authSession!.user.name,
        role: request.merchantAccess!.role,
        permissions: request.merchantAccess!.permissions,
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

  app.post("/api/merchant/categories", { preHandler: categoryEditor }, async (request, reply) => {
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
    { preHandler: categoryEditor },
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
    { preHandler: categoryEditor },
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

    // Opening stock writes a movement, so it needs the stock permission.
    if (input.stockQty > 0 && !can(request, "stock")) {
      return reply
        .code(403)
        .send({ error: "You do not have permission to add opening stock." });
    }

    let categoryId = input.categoryId ?? null;

    // Readable SKUs are generated only when the merchant leaves the field blank.
    const sku = input.sku ?? (await generateSku(merchantId, input.name));

    // `categoryName` wins so the product form can create a category inline.
    if (input.categoryName) {
      const resolved = await resolveCategoryName(
        merchantId,
        input.categoryName,
        can(request, "categories"),
      );
      if (resolved.denied) {
        return reply.code(403).send({
          error:
            "That category does not exist and you do not have permission to create one.",
        });
      }
      categoryId = resolved.id;
    } else if (categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, categoryId), eq(categories.merchantId, merchantId)))
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
            categoryId,
            sku,
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
        return reply.code(409).send({ error: uniqueViolationMessage(error) });
      }
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/merchant/products/:id",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const [product] = await db
        .select({
          ...getTableColumns(products),
          categoryName: categories.name,
        })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .where(
          and(
            eq(products.id, request.params.id),
            eq(products.merchantId, merchantId),
          ),
        )
        .limit(1);

      if (!product) {
        return reply.code(404).send({ error: "Not found" });
      }

      return product;
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/merchant/products/:id",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(productUpdateInput, request.body, reply);
      if (!input) return;

      // Check first so a bad id cannot create a category as a side effect.
      const [existing] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, request.params.id), eq(products.merchantId, merchantId)))
        .limit(1);

      if (!existing) return notFound(reply);

      const patch: Record<string, unknown> = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );

      // Never write the helper field; it is resolved into categoryId.
      delete patch.categoryName;

      if (input.categoryName !== undefined) {
        // An empty name clears the category, otherwise reuse or create it.
        if (input.categoryName) {
          const resolved = await resolveCategoryName(
            merchantId,
            input.categoryName,
            can(request, "categories"),
          );
          if (resolved.denied) {
            return reply.code(403).send({
              error:
                "That category does not exist and you do not have permission to create one.",
            });
          }
          patch.categoryId = resolved.id;
        } else {
          patch.categoryId = null;
        }
      } else if (input.categoryId) {
        const [category] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.id, input.categoryId), eq(categories.merchantId, merchantId)))
          .limit(1);
        if (!category) return reply.code(400).send({ error: "Category not found" });
      }

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
          return reply.code(409).send({ error: uniqueViolationMessage(error) });
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
    { preHandler: stockMover },
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
    { preHandler: stockMover },
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

  app.get("/api/merchant/movements", { preHandler: stockMover }, async (request) => {
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
