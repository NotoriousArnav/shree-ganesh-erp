import type { FastifyInstance, FastifyRequest } from "fastify";
import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "@ganesh/db";
import {
  catalogueItems,
  inventoryItems,
  invoiceKindValues,
  invoiceLines,
  invoiceSequences,
  invoices,
  invoiceStatusValues,
  merchants,
  stockMovements,
} from "@ganesh/db/schema";
import { requireMerchant } from "@ganesh/server/http/auth-guard";
import {
  isUniqueViolation,
  uniqueConstraint,
} from "@ganesh/server/http/pg-errors";
import {
  deriveLineStatus,
  financialYearFor,
  formatInvoiceNumber,
  invoiceLineTotals,
  invoiceTotals,
  quantityError,
  roundQuantity,
} from "@ganesh/shared";

import {
  merchantIdOf,
  notFound,
  optionalDate,
  optionalText,
  parse,
  todayIso,
} from "../http/route-utils.js";

/**
 * Lokkhi invoice API.
 *
 * The guiding rule: an invoice line is a self-contained snapshot. Mushak is an
 * optional suggestion source. Nothing here rejects a line because a catalogue
 * item is missing, archived, deleted, or because the stock update fails.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const money = z.coerce.number().min(0).max(10_000_000);
const quantity = z.coerce.number().positive().max(10_000_000);

const lineInput = z
  .object({
    catalogueItemId: z.uuid().nullish(),
    itemName: z.string().trim().min(1, "Item name is required").max(200),
    sku: optionalText(64),
    hsnCode: optionalText(16),
    unit: z.string().trim().min(1).max(20).default("pcs"),
    quantity,
    unitPrice: money,
    discount: money.default(0),
    taxRate: z.coerce.number().min(0).max(100).default(0),
  })
  .superRefine((value, ctx) => {
    // Counted units must be whole numbers; measured units may be fractional.
    const message = quantityError(value.unit, value.quantity);
    if (message) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message });
    }
  });

/** Optional, but when present it must look like a phone number. */
const phone = optionalText(32).refine(
  (value) => value == null || /^\+?[\d\s()-]{6,32}$/.test(value),
  "Enter a valid phone number",
);

const invoiceInput = z.object({
  kind: z.enum(invoiceKindValues).default("sale"),
  invoiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .default(todayIso),
  dueDate: optionalDate,
  partyName: z.string().trim().min(1, "Party name is required").max(160),
  partyPhone: phone,
  partyGstin: optionalText(20),
  partyAddress: z.record(z.string(), z.string()).nullish(),
  notes: optionalText(2000),
  lines: z.array(lineInput).max(200).default([]),
});

const invoiceUpdateInput = z.object({
  kind: z.enum(invoiceKindValues).optional(),
  invoiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  dueDate: optionalDate,
  partyName: z.string().trim().min(1).max(160).optional(),
  partyPhone: phone,
  partyGstin: optionalText(20),
  partyAddress: z.record(z.string(), z.string()).nullish(),
  notes: optionalText(2000),
  lines: z.array(lineInput).max(200).optional(),
});

type LineInput = z.infer<typeof lineInput>;

/** Fills missing snapshot details from the catalogue, without overwriting. */
async function resolveLineSnapshots(
  tx: Tx,
  merchantId: string,
  lines: LineInput[],
) {
  const ids = [
    ...new Set(
      lines
        .map((line) => line.catalogueItemId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const rows = ids.length
    ? await tx
        .select()
        .from(catalogueItems)
        .where(
          and(
            eq(catalogueItems.merchantId, merchantId),
            inArray(catalogueItems.id, ids),
          ),
        )
    : [];

  const byId = new Map(rows.map((row) => [row.id, row]));

  return lines.map((line, index) => {
    // An unknown id is treated as a manual line, never an error.
    const catalogue = line.catalogueItemId
      ? byId.get(line.catalogueItemId)
      : undefined;

    const totals = invoiceLineTotals(line);

    return {
      merchantId,
      position: index,
      catalogueItemId: catalogue?.id ?? null,
      itemName: line.itemName,
      sku: line.sku ?? catalogue?.sku ?? null,
      hsnCode: line.hsnCode ?? catalogue?.hsnCode ?? null,
      unit: line.unit || catalogue?.unit || "pcs",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxRate: line.taxRate,
      lineSubtotal: totals.lineSubtotal,
      lineTaxable: totals.lineTaxable,
      lineTax: totals.lineTax,
      lineTotal: totals.lineTotal,
    };
  });
}

async function replaceLines(
  tx: Tx,
  merchantId: string,
  invoiceId: string,
  lines: LineInput[],
) {
  await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));

  if (lines.length === 0) return;

  const snapshots = await resolveLineSnapshots(tx, merchantId, lines);
  await tx
    .insert(invoiceLines)
    .values(snapshots.map((line) => ({ ...line, invoiceId })));
}

async function recalculateInvoice(tx: Tx, invoiceId: string) {
  const lines = await tx
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId));

  const totals = invoiceTotals(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxRate: line.taxRate,
    })),
  );

  await tx.update(invoices).set(totals).where(eq(invoices.id, invoiceId));
  return totals;
}

async function loadInvoiceDetail(merchantId: string | null, id: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      merchantId
        ? and(eq(invoices.id, id), eq(invoices.merchantId, merchantId))
        : eq(invoices.id, id),
    )
    .limit(1);

  if (!invoice) return null;

  const rows = await db
    .select({
      line: invoiceLines,
      catalogueId: catalogueItems.id,
      catalogueActive: catalogueItems.isActive,
      catalogueName: catalogueItems.name,
      catalogueStock: sql<number>`coalesce(${inventoryItems.stockQty}, 0)::float8`,
    })
    .from(invoiceLines)
    .leftJoin(
      catalogueItems,
      eq(catalogueItems.id, invoiceLines.catalogueItemId),
    )
    .leftJoin(
      inventoryItems,
      eq(inventoryItems.catalogueItemId, catalogueItems.id),
    )
    .where(eq(invoiceLines.invoiceId, invoice.id))
    .orderBy(asc(invoiceLines.position));

  return {
    ...invoice,
    lines: rows.map(({ line, catalogueId, catalogueActive, catalogueName, catalogueStock }) => ({
      ...line,
      catalogueItem: catalogueId
        ? {
            id: catalogueId,
            name: catalogueName,
            isActive: Boolean(catalogueActive),
            stockQty: catalogueStock,
          }
        : null,
      lineStatus: deriveLineStatus({
        catalogueItemId: line.catalogueItemId,
        catalogueItem: catalogueId
          ? { isActive: Boolean(catalogueActive) }
          : null,
      }),
    })),
  };
}

/** Reason a best-effort stock update was skipped, kept as a muted note. */
class StockSkip extends Error {}

/**
 * Applies one line's stock movement inside its own savepoint. A failure rolls
 * back only this line; the invoice still issues.
 */
async function applyLineStock(
  tx: Tx,
  invoice: { id: string; merchantId: string; kind: "sale" | "purchase"; number: string | null },
  line: { id: string; catalogueItemId: string | null; quantity: number; unitPrice: number; unit: string },
) {
  if (!line.catalogueItemId) {
    await tx
      .update(invoiceLines)
      .set({ stockSyncState: "not_applicable", stockSyncNote: null })
      .where(eq(invoiceLines.id, line.id));
    return;
  }

  try {
    await tx.transaction(async (sp) => {
      const [item] = await sp
        .select({ id: catalogueItems.id, isActive: catalogueItems.isActive })
        .from(catalogueItems)
        .where(
          and(
            eq(catalogueItems.id, line.catalogueItemId!),
            eq(catalogueItems.merchantId, invoice.merchantId),
          ),
        )
        .limit(1);

      if (!item) throw new StockSkip("Item is no longer in Mushak");
      if (!item.isActive) throw new StockSkip("Item is archived in Mushak");

      const [stock] = await sp
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.catalogueItemId, item.id),
            eq(inventoryItems.merchantId, invoice.merchantId),
          ),
        )
        .for("update")
        .limit(1);

      if (!stock) throw new StockSkip("Item has no stock row in Mushak");

      const delta =
        invoice.kind === "sale" ? -line.quantity : line.quantity;

      if (invoice.kind === "sale" && stock.stockQty < line.quantity) {
        throw new StockSkip(
          `Only ${stock.stockQty} ${line.unit} in stock, nothing was deducted`,
        );
      }

      const [movement] = await sp
        .insert(stockMovements)
        .values({
          merchantId: invoice.merchantId,
          inventoryItemId: stock.id,
          type: invoice.kind === "sale" ? "sale" : "purchase",
          quantity: delta,
          unitCost: line.unitPrice,
          referenceType: "invoice",
          referenceId: invoice.id,
          note: invoice.number ? `Invoice ${invoice.number}` : "Invoice",
        })
        .returning({ id: stockMovements.id });

      await sp
        .update(inventoryItems)
        .set({ stockQty: roundQuantity(stock.stockQty + delta) })
        .where(eq(inventoryItems.id, stock.id));

      await sp
        .update(invoiceLines)
        .set({
          stockMovementId: movement.id,
          stockSyncState: "synced",
          stockSyncNote: null,
        })
        .where(eq(invoiceLines.id, line.id));
    });
  } catch (error) {
    await tx
      .update(invoiceLines)
      .set({
        stockSyncState: "failed",
        stockSyncNote:
          error instanceof StockSkip
            ? error.message
            : "Stock could not be updated. Try again later.",
      })
      .where(eq(invoiceLines.id, line.id));
  }
}

async function applyStockForInvoice(tx: Tx, invoiceId: string) {
  const [invoice] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) return;

  const lines = await tx
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoice.id));

  for (const line of lines) {
    if (line.stockSyncState === "synced") continue;
    await applyLineStock(tx, invoice, line);
  }
}

function stockConflictMessage(error: unknown) {
  const constraint = uniqueConstraint(error);
  if (constraint === "catalogue_items_merchant_sku_idx") {
    return "That SKU is already used by another product";
  }
  if (constraint === "catalogue_items_merchant_barcode_idx") {
    return "That barcode is already used by another product";
  }
  return "That SKU or barcode is already used by another product";
}

export async function registerInvoiceRoutes(app: FastifyInstance) {
  const scoped = requireMerchant();

  // ---- Suggestions --------------------------------------------------------

  /**
   * Thin wrapper over the catalogue. Returns nothing when the query is empty.
   * A failure here is the frontend's cue to fall back to manual lines.
   */
  app.get("/api/merchant/invoices/suggestions", { preHandler: scoped }, async (request) => {
    const merchantId = merchantIdOf(request);
    const query = request.query as { q?: string };
    const search = query.q?.trim();

    if (!search) return [];

    const pattern = `%${search}%`;

    return db
      .select({
        id: catalogueItems.id,
        name: catalogueItems.name,
        sku: catalogueItems.sku,
        hsnCode: catalogueItems.hsnCode,
        unit: catalogueItems.unit,
        taxRate: catalogueItems.taxRate,
        purchasePrice: catalogueItems.purchasePrice,
        sellingPrice: catalogueItems.sellingPrice,
        stockQty: sql<number>`coalesce(${inventoryItems.stockQty}, 0)::float8`,
      })
      .from(catalogueItems)
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.catalogueItemId, catalogueItems.id),
      )
      .where(
        and(
          eq(catalogueItems.merchantId, merchantId),
          eq(catalogueItems.isActive, true),
          or(
            ilike(catalogueItems.name, pattern),
            ilike(catalogueItems.sku, pattern),
            ilike(catalogueItems.barcode, pattern),
          ),
        ),
      )
      .orderBy(asc(catalogueItems.name))
      .limit(10);
  });

  // ---- List ---------------------------------------------------------------

  app.get("/api/merchant/invoices", { preHandler: scoped }, async (request) => {
    const merchantId = merchantIdOf(request);
    const query = request.query as {
      kind?: string;
      status?: string;
      from?: string;
      to?: string;
      q?: string;
      limit?: string;
      offset?: string;
    };

    const filters: SQL[] = [eq(invoices.merchantId, merchantId)];

    if (query.kind && (invoiceKindValues as readonly string[]).includes(query.kind)) {
      filters.push(eq(invoices.kind, query.kind as (typeof invoiceKindValues)[number]));
    }

    if (
      query.status &&
      (invoiceStatusValues as readonly string[]).includes(query.status)
    ) {
      filters.push(
        eq(invoices.status, query.status as (typeof invoiceStatusValues)[number]),
      );
    }

    if (query.from) filters.push(gte(invoices.invoiceDate, query.from));
    if (query.to) filters.push(lte(invoices.invoiceDate, query.to));

    const search = query.q?.trim();
    if (search) {
      const pattern = `%${search}%`;
      filters.push(
        or(
          ilike(invoices.number, pattern),
          ilike(invoices.partyName, pattern),
        )!,
      );
    }

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const where = and(...filters);

    const rows = await db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.invoiceDate), desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(invoices)
      .where(where);

    const ids = rows.map((row) => row.id);

    const counts = ids.length
      ? await db
          .select({
            invoiceId: invoiceLines.invoiceId,
            manual: sql<number>`count(*) filter (where ${invoiceLines.catalogueItemId} is null)::int`,
            stockFailed: sql<number>`count(*) filter (where ${invoiceLines.stockSyncState} = 'failed')::int`,
          })
          .from(invoiceLines)
          .where(inArray(invoiceLines.invoiceId, ids))
          .groupBy(invoiceLines.invoiceId)
      : [];

    const byId = new Map(counts.map((row) => [row.invoiceId, row]));

    return {
      total,
      items: rows.map((row) => ({
        ...row,
        manualItemCount: byId.get(row.id)?.manual ?? 0,
        stockFailedCount: byId.get(row.id)?.stockFailed ?? 0,
      })),
    };
  });

  // ---- Detail -------------------------------------------------------------

  app.get<{ Params: { id: string } }>(
    "/api/merchant/invoices/:id",
    { preHandler: scoped },
    async (request, reply) => {
      const invoice = await loadInvoiceDetail(
        merchantIdOf(request),
        request.params.id,
      );
      if (!invoice) return notFound(reply);
      return invoice;
    },
  );

  // ---- Public share -------------------------------------------------------

  /**
   * Read-only invoice for a shared link (`/invoices/:id?anon=true`).
   *
   * The id is an unguessable UUID and the response deliberately omits internal
   * stock-sync details, catalogue links and the merchant id; only what appears
   * on the invoice document is returned. Anyone holding the link can read it,
   * so the UI warns about that before sharing.
   */
  app.get<{ Params: { id: string } }>(
    "/api/public/invoices/:id",
    async (request, reply) => {
      const invoice = await loadInvoiceDetail(null, request.params.id);
      if (!invoice) return notFound(reply);

      const [merchant] = await db
        .select({ name: merchants.name })
        .from(merchants)
        .where(eq(merchants.id, invoice.merchantId))
        .limit(1);

      return {
        id: invoice.id,
        kind: invoice.kind,
        status: invoice.status,
        number: invoice.number,
        financialYear: invoice.financialYear,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        partyName: invoice.partyName,
        partyPhone: invoice.partyPhone,
        partyGstin: invoice.partyGstin,
        partyAddress: invoice.partyAddress,
        currency: invoice.currency,
        notes: invoice.notes,
        subtotal: invoice.subtotal,
        discountTotal: invoice.discountTotal,
        taxTotal: invoice.taxTotal,
        total: invoice.total,
        issuedAt: invoice.issuedAt,
        voidedAt: invoice.voidedAt,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        issuerName: merchant?.name ?? null,
        lines: invoice.lines.map((line) => ({
          id: line.id,
          invoiceId: line.invoiceId,
          position: line.position,
          catalogueItemId: null,
          itemName: line.itemName,
          sku: line.sku,
          hsnCode: line.hsnCode,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          taxRate: line.taxRate,
          lineSubtotal: line.lineSubtotal,
          lineTaxable: line.lineTaxable,
          lineTax: line.lineTax,
          lineTotal: line.lineTotal,
          stockMovementId: null,
          stockSyncState: "not_applicable" as const,
          stockSyncNote: null,
          lineStatus: line.lineStatus,
          catalogueItem: null,
        })),
      };
    },
  );

  // ---- Create -------------------------------------------------------------

  app.post("/api/merchant/invoices", { preHandler: scoped }, async (request, reply) => {
    const merchantId = merchantIdOf(request);
    const input = parse(invoiceInput, request.body, reply);
    if (!input) return;

    const invoice = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(invoices)
        .values({
          merchantId,
          kind: input.kind,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          partyName: input.partyName,
          partyPhone: input.partyPhone ?? null,
          partyGstin: input.partyGstin ?? null,
          partyAddress: input.partyAddress ?? null,
          notes: input.notes ?? null,
          createdBy: request.merchantAccess!.userId,
        })
        .returning();

      await replaceLines(tx, merchantId, created.id, input.lines);
      await recalculateInvoice(tx, created.id);
      return created;
    });

    return reply.code(201).send(await loadInvoiceDetail(merchantId, invoice.id));
  });

  // ---- Update (draft only) ------------------------------------------------

  app.patch<{ Params: { id: string } }>(
    "/api/merchant/invoices/:id",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(invoiceUpdateInput, request.body, reply);
      if (!input) return;

      const result = await db.transaction(async (tx) => {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, request.params.id),
              eq(invoices.merchantId, merchantId),
            ),
          )
          .for("update")
          .limit(1);

        if (!invoice) return { kind: "not_found" as const };
        if (invoice.status !== "draft") {
          return {
            kind: "conflict" as const,
            message: "Only draft invoices can be edited",
          };
        }

        const changes: Partial<typeof invoices.$inferInsert> = {};
        if (input.kind !== undefined) changes.kind = input.kind;
        if (input.invoiceDate !== undefined) changes.invoiceDate = input.invoiceDate;
        if (input.dueDate !== undefined) changes.dueDate = input.dueDate;
        if (input.partyName !== undefined) changes.partyName = input.partyName;
        if (input.partyPhone !== undefined) changes.partyPhone = input.partyPhone;
        if (input.partyGstin !== undefined) changes.partyGstin = input.partyGstin;
        if (input.partyAddress !== undefined) changes.partyAddress = input.partyAddress;
        if (input.notes !== undefined) changes.notes = input.notes;

        if (Object.keys(changes).length > 0) {
          await tx
            .update(invoices)
            .set(changes)
            .where(eq(invoices.id, invoice.id));
        }

        if (input.lines !== undefined) {
          await replaceLines(tx, merchantId, invoice.id, input.lines);
        }

        await recalculateInvoice(tx, invoice.id);
        return { kind: "ok" as const, id: invoice.id };
      });

      if (result.kind === "not_found") return notFound(reply);
      if (result.kind === "conflict") {
        return reply.code(409).send({ error: result.message });
      }

      return loadInvoiceDetail(merchantId, result.id);
    },
  );

  // ---- Delete (draft only) ------------------------------------------------

  app.delete<{ Params: { id: string } }>(
    "/api/merchant/invoices/:id",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const [deleted] = await db
        .delete(invoices)
        .where(
          and(
            eq(invoices.id, request.params.id),
            eq(invoices.merchantId, merchantId),
            eq(invoices.status, "draft"),
          ),
        )
        .returning({ id: invoices.id });

      if (!deleted) {
        const [existing] = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(
            and(
              eq(invoices.id, request.params.id),
              eq(invoices.merchantId, merchantId),
            ),
          )
          .limit(1);

        return existing
          ? reply.code(409).send({ error: "Only drafts can be deleted" })
          : notFound(reply);
      }

      return { id: deleted.id };
    },
  );

  // ---- Issue --------------------------------------------------------------

  app.post<{ Params: { id: string } }>(
    "/api/merchant/invoices/:id/issue",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const result = await db.transaction(async (tx) => {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, request.params.id),
              eq(invoices.merchantId, merchantId),
            ),
          )
          .for("update")
          .limit(1);

        if (!invoice) return { kind: "not_found" as const };
        if (invoice.status !== "draft") {
          return {
            kind: "conflict" as const,
            message: "This invoice has already been issued",
          };
        }

        const [lineCount] = await tx
          .select({ total: sql<number>`count(*)::int` })
          .from(invoiceLines)
          .where(eq(invoiceLines.invoiceId, invoice.id));

        if (lineCount.total === 0) {
          return {
            kind: "invalid" as const,
            message: "Add at least one item before issuing this invoice",
          };
        }

        const financialYear = financialYearFor(
          new Date(`${invoice.invoiceDate}T00:00:00`),
        );

        await tx
          .insert(invoiceSequences)
          .values({
            merchantId,
            kind: invoice.kind,
            financialYear,
          })
          .onConflictDoNothing();

        const [sequence] = await tx
          .select()
          .from(invoiceSequences)
          .where(
            and(
              eq(invoiceSequences.merchantId, merchantId),
              eq(invoiceSequences.kind, invoice.kind),
              eq(invoiceSequences.financialYear, financialYear),
            ),
          )
          .for("update")
          .limit(1);

        const number = formatInvoiceNumber(
          invoice.kind,
          financialYear,
          sequence.nextNumber,
        );

        await tx
          .update(invoiceSequences)
          .set({ nextNumber: sequence.nextNumber + 1 })
          .where(eq(invoiceSequences.id, sequence.id));

        await tx
          .update(invoices)
          .set({
            status: "issued",
            number,
            financialYear,
            issuedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));

        await applyStockForInvoice(tx, invoice.id);

        return { kind: "ok" as const, id: invoice.id };
      });

      if (result.kind === "not_found") return notFound(reply);
      if (result.kind === "conflict" || result.kind === "invalid") {
        return reply.code(409).send({ error: result.message });
      }

      return loadInvoiceDetail(merchantId, result.id);
    },
  );

  // ---- Void ---------------------------------------------------------------

  app.post<{ Params: { id: string } }>(
    "/api/merchant/invoices/:id/void",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const result = await db.transaction(async (tx) => {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, request.params.id),
              eq(invoices.merchantId, merchantId),
            ),
          )
          .for("update")
          .limit(1);

        if (!invoice) return { kind: "not_found" as const };
        if (invoice.status !== "issued") {
          return {
            kind: "conflict" as const,
            message: "Only issued invoices can be voided",
          };
        }

        const lines = await tx
          .select()
          .from(invoiceLines)
          .where(eq(invoiceLines.invoiceId, invoice.id));

        // Reverse only what was actually applied. Best effort, per line.
        for (const line of lines) {
          if (!line.stockMovementId || line.stockSyncState !== "synced") continue;

          try {
            await tx.transaction(async (sp) => {
              const [movement] = await sp
                .select()
                .from(stockMovements)
                .where(eq(stockMovements.id, line.stockMovementId!))
                .limit(1);

              if (!movement) return;

              const reversal = -movement.quantity;

              await sp.insert(stockMovements).values({
                merchantId,
                inventoryItemId: movement.inventoryItemId,
                type:
                  invoice.kind === "sale" ? "return_in" : "return_out",
                quantity: reversal,
                unitCost: movement.unitCost,
                referenceType: "invoice_void",
                referenceId: invoice.id,
                note: invoice.number
                  ? `Voided invoice ${invoice.number}`
                  : "Voided invoice",
              });

              const [stock] = await sp
                .select()
                .from(inventoryItems)
                .where(eq(inventoryItems.id, movement.inventoryItemId))
                .for("update")
                .limit(1);

              if (stock) {
                await sp
                  .update(inventoryItems)
                  .set({ stockQty: roundQuantity(stock.stockQty + reversal) })
                  .where(eq(inventoryItems.id, stock.id));
              }
            });
          } catch {
            // A failed reversal leaves history intact; the void still counts.
          }
        }

        await tx
          .update(invoices)
          .set({ status: "void", voidedAt: new Date() })
          .where(eq(invoices.id, invoice.id));

        return { kind: "ok" as const, id: invoice.id };
      });

      if (result.kind === "not_found") return notFound(reply);
      if (result.kind === "conflict") {
        return reply.code(409).send({ error: result.message });
      }

      return loadInvoiceDetail(merchantId, result.id);
    },
  );

  // ---- Retry one line's stock --------------------------------------------

  app.post<{ Params: { id: string; lineId: string } }>(
    "/api/merchant/invoices/:id/lines/:lineId/retry-stock",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);

      const result = await db.transaction(async (tx) => {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, request.params.id),
              eq(invoices.merchantId, merchantId),
            ),
          )
          .limit(1);

        if (!invoice) return { kind: "not_found" as const };
        if (invoice.status !== "issued") {
          return {
            kind: "conflict" as const,
            message: "Stock is applied when the invoice is issued",
          };
        }

        const [line] = await tx
          .select()
          .from(invoiceLines)
          .where(
            and(
              eq(invoiceLines.id, request.params.lineId),
              eq(invoiceLines.invoiceId, invoice.id),
            ),
          )
          .limit(1);

        if (!line) return { kind: "not_found" as const };

        if (line.stockSyncState !== "synced") {
          await applyLineStock(tx, invoice, line);
        }

        return { kind: "ok" as const };
      });

      if (result.kind === "not_found") return notFound(reply);
      if (result.kind === "conflict") {
        return reply.code(409).send({ error: result.message });
      }

      return loadInvoiceDetail(merchantId, request.params.id);
    },
  );

  // ---- Add to Mushak ------------------------------------------------------

  const addToMushakInput = z.object({
    name: z.string().trim().min(1).max(160).optional(),
    sku: optionalText(64),
    unit: z.string().trim().min(1).max(20).optional(),
    hsnCode: optionalText(16),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    price: z.coerce.number().min(0).max(10_000_000).optional(),
    categoryId: z.uuid().nullish(),
  });

  app.post<{ Params: { id: string; lineId: string } }>(
    "/api/merchant/invoices/:id/lines/:lineId/add-to-mushak",
    { preHandler: scoped },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(addToMushakInput, request.body ?? {}, reply);
      if (!input) return;

      const [invoice] = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, request.params.id),
            eq(invoices.merchantId, merchantId),
          ),
        )
        .limit(1);

      if (!invoice) return notFound(reply);

      const [line] = await db
        .select()
        .from(invoiceLines)
        .where(
          and(
            eq(invoiceLines.id, request.params.lineId),
            eq(invoiceLines.invoiceId, invoice.id),
          ),
        )
        .limit(1);

      if (!line) return notFound(reply);

      if (line.catalogueItemId) {
        return reply
          .code(409)
          .send({ error: "This line is already linked to a Mushak item" });
      }

      try {
        const created = await db.transaction(async (tx) => {
          const [catalogue] = await tx
            .insert(catalogueItems)
            .values({
              merchantId,
              name: input.name ?? line.itemName,
              sku: input.sku ?? null,
              unit: input.unit ?? line.unit,
              hsnCode: input.hsnCode ?? line.hsnCode,
              taxRate: input.taxRate ?? line.taxRate,
              // Prices are a suggestion for Mushak; the invoice snapshot is
              // never rewritten, so historical totals cannot change.
              purchasePrice:
                invoice.kind === "purchase" ? input.price ?? line.unitPrice : 0,
              sellingPrice:
                invoice.kind === "sale" ? input.price ?? line.unitPrice : 0,
              categoryId: input.categoryId ?? null,
            })
            .returning();

          await tx.insert(inventoryItems).values({
            merchantId,
            catalogueItemId: catalogue.id,
          });

          await tx
            .update(invoiceLines)
            .set({ catalogueItemId: catalogue.id })
            .where(eq(invoiceLines.id, line.id));

          return catalogue;
        });

        return reply.code(201).send({
          catalogueItem: created,
          invoice: await loadInvoiceDetail(merchantId, invoice.id),
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({ error: stockConflictMessage(error) });
        }
        throw error;
      }
    },
  );
}
