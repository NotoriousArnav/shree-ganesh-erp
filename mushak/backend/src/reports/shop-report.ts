import { and, asc, desc, eq, isNull, lte, gte, sql } from "drizzle-orm";

import { db } from "../db.js";
import {
  catalogueItems,
  categories,
  inventoryItems,
  merchants,
  stockMovements,
} from "../db/schema.js";

/**
 * Shop dashboard and printable report queries.
 *
 * Every range is Unix epoch seconds. Both bounds are inclusive, so a movement
 * created exactly at the `to` second is included.
 */

export const MAX_RANGE_SECONDS = 366 * 24 * 60 * 60;

export type EpochRange = { from: number; to: number };

export type LowStockRow = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  reorderLevel: number;
};

export type OutOfStockRow = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  updatedAt: Date;
};

export type CategoryValue = {
  id: string | null;
  name: string;
  products: number;
  cost: number;
  retail: number;
};

export type TopValueProduct = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  cost: number;
  retail: number;
};

export type StockHealth = {
  outOfStock: number;
  low: number;
  healthy: number;
};

export type MovementRow = {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  type: string;
  quantity: number;
  unitCost: number | null;
  note: string | null;
  createdAt: Date;
};

type Snapshot = {
  merchant: typeof merchants.$inferSelect | null;
  counts: {
    products: number;
    activeProducts: number;
    categories: number;
    lowStock: number;
  };
  value: {
    cost: number;
    retail: number;
    margin: number;
    currency: string;
  };
  stockHealth: StockHealth;
  categories: CategoryValue[];
  topValue: TopValueProduct[];
  lowStock: LowStockRow[];
  outOfStock: OutOfStockRow[];
};

const quantitySum = (positive: boolean) =>
  positive
    ? sql<number>`coalesce(sum(case when ${stockMovements.quantity} > 0 then ${stockMovements.quantity} else 0 end), 0)::float8`
    : sql<number>`coalesce(sum(case when ${stockMovements.quantity} < 0 then -${stockMovements.quantity} else 0 end), 0)::float8`;

async function loadSnapshot(
  merchantId: string,
  limits: { lowStock: number; outOfStock: number },
): Promise<Snapshot> {
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  const [catalogueStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${catalogueItems.isActive})::int`,
    })
    .from(catalogueItems)
    .where(eq(catalogueItems.merchantId, merchantId));

  const [categoryStats] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(categories)
    .where(eq(categories.merchantId, merchantId));

  const [valueStats] = await db
    .select({
      stockValue: sql<number>`coalesce(sum(${inventoryItems.stockQty} * ${catalogueItems.purchasePrice}), 0)::float8`,
      retailValue: sql<number>`coalesce(sum(${inventoryItems.stockQty} * ${catalogueItems.sellingPrice}), 0)::float8`,
    })
    .from(inventoryItems)
    .innerJoin(
      catalogueItems,
      eq(catalogueItems.id, inventoryItems.catalogueItemId),
    )
    .where(eq(inventoryItems.merchantId, merchantId));

  const lowStockWhere = and(
    eq(inventoryItems.merchantId, merchantId),
    eq(catalogueItems.isActive, true),
    gte(inventoryItems.reorderLevel, sql`0.001`),
    sql`${inventoryItems.stockQty} <= ${inventoryItems.reorderLevel}`,
  );

  const [lowStockStats] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .innerJoin(
      catalogueItems,
      eq(catalogueItems.id, inventoryItems.catalogueItemId),
    )
    .where(lowStockWhere);

  const [healthStats] = await db
    .select({
      outOfStock: sql<number>`count(*) filter (where ${inventoryItems.stockQty} <= 0)::int`,
      low: sql<number>`count(*) filter (
        where ${inventoryItems.stockQty} > 0
          and ${inventoryItems.reorderLevel} >= 0.001
          and ${inventoryItems.stockQty} <= ${inventoryItems.reorderLevel}
      )::int`,
      healthy: sql<number>`count(*) filter (
        where ${inventoryItems.stockQty} > 0
          and (
            ${inventoryItems.reorderLevel} < 0.001
            or ${inventoryItems.stockQty} > ${inventoryItems.reorderLevel}
          )
      )::int`,
    })
    .from(inventoryItems)
    .innerJoin(
      catalogueItems,
      eq(catalogueItems.id, inventoryItems.catalogueItemId),
    )
    .where(
      and(
        eq(inventoryItems.merchantId, merchantId),
        eq(catalogueItems.isActive, true),
      ),
    );

  const lowStock = await db
    .select({
      id: inventoryItems.id,
      name: catalogueItems.name,
      unit: catalogueItems.unit,
      stockQty: inventoryItems.stockQty,
      reorderLevel: inventoryItems.reorderLevel,
    })
    .from(inventoryItems)
    .innerJoin(
      catalogueItems,
      eq(catalogueItems.id, inventoryItems.catalogueItemId),
    )
    .where(lowStockWhere)
    .orderBy(asc(inventoryItems.stockQty), asc(catalogueItems.name))
    .limit(limits.lowStock);

  const outOfStock = await db
    .select({
      id: inventoryItems.id,
      name: catalogueItems.name,
      unit: catalogueItems.unit,
      stockQty: inventoryItems.stockQty,
      updatedAt: inventoryItems.updatedAt,
    })
    .from(inventoryItems)
    .innerJoin(
      catalogueItems,
      eq(catalogueItems.id, inventoryItems.catalogueItemId),
    )
    .where(
      and(
        eq(inventoryItems.merchantId, merchantId),
        eq(catalogueItems.isActive, true),
        lte(inventoryItems.stockQty, sql`0`),
      ),
    )
    .orderBy(asc(catalogueItems.name))
    .limit(limits.outOfStock);

  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      products: sql<number>`count(${catalogueItems.id})::int`,
      cost: sql<number>`coalesce(sum(${inventoryItems.stockQty} * ${catalogueItems.purchasePrice}), 0)::float8`,
      retail: sql<number>`coalesce(sum(${inventoryItems.stockQty} * ${catalogueItems.sellingPrice}), 0)::float8`,
    })
    .from(categories)
    .leftJoin(
      catalogueItems,
      and(
        eq(catalogueItems.categoryId, categories.id),
        eq(catalogueItems.merchantId, merchantId),
      ),
    )
    .leftJoin(
      inventoryItems,
      eq(inventoryItems.catalogueItemId, catalogueItems.id),
    )
    .where(eq(categories.merchantId, merchantId))
    .groupBy(categories.id)
    .orderBy(desc(sql`coalesce(sum(${inventoryItems.stockQty} * ${catalogueItems.sellingPrice}), 0)`));

  const [uncategorised] = await db
    .select({
      products: sql<number>`count(${catalogueItems.id})::int`,
      cost: sql<number>`coalesce(sum(${inventoryItems.stockQty} * ${catalogueItems.purchasePrice}), 0)::float8`,
      retail: sql<number>`coalesce(sum(${inventoryItems.stockQty} * ${catalogueItems.sellingPrice}), 0)::float8`,
    })
    .from(catalogueItems)
    .leftJoin(
      inventoryItems,
      eq(inventoryItems.catalogueItemId, catalogueItems.id),
    )
    .where(
      and(
        eq(catalogueItems.merchantId, merchantId),
        isNull(catalogueItems.categoryId),
      ),
    );

  const categoryValues: CategoryValue[] = categoryRows.map((row) => ({
    id: row.id,
    name: row.name,
    products: row.products,
    cost: row.cost,
    retail: row.retail,
  }));

  if (uncategorised && uncategorised.products > 0) {
    categoryValues.push({
      id: null,
      name: "Uncategorised",
      products: uncategorised.products,
      cost: uncategorised.cost,
      retail: uncategorised.retail,
    });
  }

  const topValue = await db
    .select({
      id: inventoryItems.id,
      name: catalogueItems.name,
      unit: catalogueItems.unit,
      stockQty: inventoryItems.stockQty,
      cost: sql<number>`(${inventoryItems.stockQty} * ${catalogueItems.purchasePrice})::float8`,
      retail: sql<number>`(${inventoryItems.stockQty} * ${catalogueItems.sellingPrice})::float8`,
    })
    .from(inventoryItems)
    .innerJoin(
      catalogueItems,
      eq(catalogueItems.id, inventoryItems.catalogueItemId),
    )
    .where(
      and(
        eq(inventoryItems.merchantId, merchantId),
        eq(catalogueItems.isActive, true),
        sql`${inventoryItems.stockQty} > 0`,
      ),
    )
    .orderBy(desc(sql`${inventoryItems.stockQty} * ${catalogueItems.sellingPrice}`))
    .limit(5);

  const cost = valueStats?.stockValue ?? 0;
  const retail = valueStats?.retailValue ?? 0;

  return {
    merchant: merchant ?? null,
    counts: {
      products: catalogueStats?.total ?? 0,
      activeProducts: catalogueStats?.active ?? 0,
      categories: categoryStats?.total ?? 0,
      lowStock: lowStockStats?.total ?? 0,
    },
    value: {
      cost,
      retail,
      margin: retail - cost,
      currency: merchant?.currency ?? "INR",
    },
    stockHealth: {
      outOfStock: healthStats?.outOfStock ?? 0,
      low: healthStats?.low ?? 0,
      healthy: healthStats?.healthy ?? 0,
    },
    categories: categoryValues,
    topValue,
    lowStock,
    outOfStock,
  };
}

type SeriesRow = { date: string; inQty: number; outQty: number };

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Fills days with no movements so the chart has a bar per day. */
function fillSeries(rows: SeriesRow[], range: EpochRange): SeriesRow[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const series: SeriesRow[] = [];

  const cursor = new Date(range.from * 1000);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(range.to * 1000);

  // A 366-day guard keeps this loop bounded even if a caller bypasses
  // parseEpochRange().
  for (let index = 0; cursor <= end && index <= 366; index += 1) {
    const key = localDateKey(cursor);
    series.push(byDate.get(key) ?? { date: key, inQty: 0, outQty: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

async function loadPeriod(
  merchantId: string,
  range: EpochRange,
  movementLimit: number,
) {
  const from = new Date(range.from * 1000);
  const to = new Date(range.to * 1000);
  const where = and(
    eq(stockMovements.merchantId, merchantId),
    gte(stockMovements.createdAt, from),
    lte(stockMovements.createdAt, to),
  );

  const [summary] = await db
    .select({
      movements: sql<number>`count(*)::int`,
      inQty: quantitySum(true),
      outQty: quantitySum(false),
    })
    .from(stockMovements)
    .where(where);

  const seriesRows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${stockMovements.createdAt}), 'YYYY-MM-DD')`,
      inQty: quantitySum(true),
      outQty: quantitySum(false),
    })
    .from(stockMovements)
    .where(where)
    .groupBy(sql`date_trunc('day', ${stockMovements.createdAt})`)
    .orderBy(asc(sql`date_trunc('day', ${stockMovements.createdAt})`));

  const rows: MovementRow[] = await db
    .select({
      id: stockMovements.id,
      productId: stockMovements.inventoryItemId,
      productName: catalogueItems.name,
      unit: catalogueItems.unit,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(
      inventoryItems,
      eq(inventoryItems.id, stockMovements.inventoryItemId),
    )
    .innerJoin(
      catalogueItems,
      eq(catalogueItems.id, inventoryItems.catalogueItemId),
    )
    .where(where)
    .orderBy(desc(stockMovements.createdAt))
    .limit(movementLimit);

  return {
    movements: summary?.movements ?? 0,
    inQty: summary?.inQty ?? 0,
    outQty: summary?.outQty ?? 0,
    series: fillSeries(seriesRows, range),
    rows,
  };
}

export async function buildDashboard(merchantId: string, range: EpochRange) {
  const snapshot = await loadSnapshot(merchantId, {
    lowStock: 8,
    outOfStock: 8,
  });
  const period = await loadPeriod(merchantId, range, 8);

  return {
    merchant: snapshot.merchant,
    range,
    counts: snapshot.counts,
    value: snapshot.value,
    stockHealth: snapshot.stockHealth,
    categories: snapshot.categories,
    topValue: snapshot.topValue,
    lowStock: snapshot.lowStock,
    period: {
      ...range,
      movements: period.movements,
      inQty: period.inQty,
      outQty: period.outQty,
      series: period.series,
    },
    recentMovements: period.rows,
  };
}

export async function buildShopReport(
  merchantId: string,
  range: EpochRange,
  generatedBy: string,
) {
  const snapshot = await loadSnapshot(merchantId, {
    lowStock: 200,
    outOfStock: 200,
  });
  const period = await loadPeriod(merchantId, range, 1000);

  return {
    merchant: snapshot.merchant,
    generatedAt: new Date().toISOString(),
    generatedBy,
    range,
    counts: snapshot.counts,
    value: snapshot.value,
    stockHealth: snapshot.stockHealth,
    categories: snapshot.categories,
    topValue: snapshot.topValue,
    lowStock: snapshot.lowStock,
    outOfStock: snapshot.outOfStock,
    period: {
      ...range,
      movements: period.movements,
      inQty: period.inQty,
      outQty: period.outQty,
    },
    movements: period.rows,
    movementTotal: period.movements,
    truncated: period.movements > period.rows.length,
  };
}

/** Midnight at the start of the current day, in the server's timezone. */
export function startOfToday(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

export function todayRange(): EpochRange {
  return {
    from: startOfToday(),
    to: Math.floor(Date.now() / 1000),
  };
}

export function lastDaysRange(days: number): EpochRange {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (Math.max(days, 1) - 1));

  return {
    from: Math.floor(from.getTime() / 1000),
    to: Math.floor(Date.now() / 1000),
  };
}

type RangeResult =
  | { ok: true; range: EpochRange }
  | { ok: false; error: string };

function readEpoch(value: unknown, name: string): number | string {
  if (value === undefined || value === "") return Number.NaN;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return `${name} must be a positive Unix timestamp in seconds`;
  }

  return parsed;
}

/**
 * Parses `from`/`to` from the query string. Both are Unix epoch seconds.
 * Omitted bounds fall back to the defaults supplied by the caller.
 */
export function parseEpochRange(
  query: unknown,
  fallback: EpochRange,
): RangeResult {
  const values =
    query && typeof query === "object"
      ? (query as Record<string, unknown>)
      : {};

  const fromValue = readEpoch(values.from, "from");
  const toValue = readEpoch(values.to, "to");

  if (typeof fromValue === "string") return { ok: false, error: fromValue };
  if (typeof toValue === "string") return { ok: false, error: toValue };

  const from = Number.isNaN(fromValue) ? fallback.from : fromValue;
  const to = Number.isNaN(toValue) ? fallback.to : toValue;

  if (to <= from) {
    return { ok: false, error: "to must be greater than from" };
  }

  if (to - from > MAX_RANGE_SECONDS) {
    return {
      ok: false,
      error: "The range must be 366 days or less",
    };
  }

  return { ok: true, range: { from, to } };
}
