import { roundMoney } from "./money.js";

export const invoiceKindValues = ["sale", "purchase"] as const;
export type InvoiceKind = (typeof invoiceKindValues)[number];

export const invoiceStatusValues = ["draft", "issued", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatusValues)[number];

/**
 * How an invoice line relates to the Mushak catalogue, derived at read time.
 *
 * - linked:   the line points at a live catalogue item
 * - missing:  the line was never linked, or the product was deleted
 * - archived: the line points at an item that was archived
 */
export const invoiceLineStatusValues = [
  "linked",
  "missing",
  "archived",
] as const;
export type InvoiceLineStatus = (typeof invoiceLineStatusValues)[number];

export const stockSyncStateValues = [
  "not_applicable",
  "synced",
  "failed",
] as const;
export type StockSyncState = (typeof stockSyncStateValues)[number];

/** Reusable line shape for totals. Money is in the merchant's currency. */
export type InvoiceLineAmountInput = {
  quantity: number;
  unitPrice: number;
  /** Absolute discount in currency, not a percentage. */
  discount: number;
  /** Combined tax rate for the line, e.g. 18 for 18%. */
  taxRate: number;
};

export type InvoiceLineTotals = {
  /** quantity x unitPrice, before discount. */
  lineSubtotal: number;
  /** The discount actually applied, clamped to the gross amount. */
  lineDiscount: number;
  /** lineSubtotal - lineDiscount, i.e. what tax is charged on. */
  lineTaxable: number;
  lineTax: number;
  /** lineTaxable + lineTax. */
  lineTotal: number;
};

/**
 * Prices are tax-exclusive: tax is added on top of (quantity x unitPrice).
 * Discounts apply before tax. Every line is self-contained, so this function
 * never needs the catalogue.
 */
export function invoiceLineTotals(
  line: InvoiceLineAmountInput,
): InvoiceLineTotals {
  const lineSubtotal = roundMoney(line.quantity * line.unitPrice);
  const lineDiscount = roundMoney(
    Math.min(Math.max(line.discount, 0), lineSubtotal),
  );
  const lineTaxable = roundMoney(lineSubtotal - lineDiscount);
  const lineTax = roundMoney((lineTaxable * line.taxRate) / 100);

  return {
    lineSubtotal,
    lineDiscount,
    lineTaxable,
    lineTax,
    lineTotal: roundMoney(lineTaxable + lineTax),
  };
}

export type InvoiceTotals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
};

export function invoiceTotals(lines: InvoiceLineAmountInput[]): InvoiceTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const totals = invoiceLineTotals(line);
    subtotal += totals.lineSubtotal;
    discountTotal += totals.lineDiscount;
    taxTotal += totals.lineTax;
  }

  subtotal = roundMoney(subtotal);
  discountTotal = roundMoney(discountTotal);
  taxTotal = roundMoney(taxTotal);

  return {
    subtotal,
    discountTotal,
    taxTotal,
    total: roundMoney(subtotal - discountTotal + taxTotal),
  };
}

/** `SALE/2026-27/0001`, `PUR/2026-27/0001`. */
export function formatInvoiceNumber(
  kind: InvoiceKind,
  financialYear: string,
  sequence: number,
) {
  const prefix = kind === "sale" ? "SALE" : "PUR";
  return `${prefix}/${financialYear}/${String(sequence).padStart(4, "0")}`;
}

/**
 * Indian financial year for a date: April through March, rendered `2026-27`.
 * Timezone comes from the server; invoice dates are calendar dates, so callers
 * should pass the date they intend rather than a timestamp near midnight.
 */
export function financialYearFor(date: Date) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const end = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${end}`;
}

/**
 * Derives the hint shown in Previous Invoices. This is the only place the rule
 * lives, so the API and the UI cannot disagree about what counts as missing.
 */
export function deriveLineStatus(line: {
  catalogueItemId: string | null;
  catalogueItem: { isActive: boolean } | null | undefined;
}): InvoiceLineStatus {
  if (!line.catalogueItemId) return "missing";
  if (!line.catalogueItem) return "missing";
  return line.catalogueItem.isActive ? "linked" : "archived";
}

/**
 * Sale movements reduce stock; purchase movements add to it. Return movements
 * are handled by voiding, not here.
 */
export function stockMovementDirection(kind: InvoiceKind): 1 | -1 {
  return kind === "sale" ? -1 : 1;
}
