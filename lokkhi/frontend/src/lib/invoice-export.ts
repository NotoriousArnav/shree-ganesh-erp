import { buildXlsx, rowsToCsv, type ExportCell, type ExportSheet } from "@ganesh/shared";

import type { Invoice } from "./types";

/**
 * Invoice exports.
 *
 * Everything is generated from the invoice the browser already has, so an
 * export always matches what is on screen. An issued invoice is a snapshot, so
 * CSV, XLSX and PDF all show the same names, prices and tax.
 */

export type ExportFormat = "csv" | "xlsx" | "pdf";

export const exportFormats: {
  value: ExportFormat;
  label: string;
  extension: string;
  description: string;
  mime: string;
}[] = [
  {
    value: "csv",
    label: "CSV",
    extension: "csv",
    description: "Plain text, opens in Excel, Sheets or any script",
    mime: "text/csv;charset=utf-8",
  },
  {
    value: "xlsx",
    label: "XLSX",
    extension: "xlsx",
    description: "Excel workbook with an invoice summary and item sheet",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    value: "pdf",
    label: "PDF",
    extension: "pdf",
    description: "Print-ready A4 document to send to a customer",
    mime: "application/pdf",
  },
];

export function formatDetails(format: ExportFormat) {
  return exportFormats.find((entry) => entry.value === format)!;
}

function kindLabel(invoice: Invoice) {
  return invoice.kind === "sale" ? "Sale" : "Purchase";
}

function partyLabel(invoice: Invoice) {
  return invoice.kind === "sale" ? "Billed to" : "Supplier";
}

/** "INR 1,234.50" — safe in every export format, including standard PDF fonts. */
export function plainMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(value);
}

function safePart(value: string) {
  return value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function invoiceFilename(invoice: Invoice, extension: string) {
  const reference = invoice.number ?? `${kindLabel(invoice)}-draft`;
  return `lokkhi-${safePart(reference).toLowerCase()}.${extension}`;
}

/** A read-only link that works without signing in. */
export function invoiceShareUrl(invoice: Pick<Invoice, "id">) {
  return `${window.location.origin}/invoices/${invoice.id}?anon=true`;
}

function summaryRows(invoice: Invoice): ExportCell[][] {
  const rows: ExportCell[][] = [
    ["Field", "Value"],
    ["Invoice", invoice.number ?? `${kindLabel(invoice)} draft`],
    ["Kind", kindLabel(invoice)],
    ["Status", invoice.status],
    ["Invoice date", invoice.invoiceDate],
    ["Due date", invoice.dueDate ?? ""],
    [partyLabel(invoice), invoice.partyName],
    ["Phone", invoice.partyPhone ?? ""],
    ["GSTIN", invoice.partyGstin ?? ""],
    ["Currency", invoice.currency],
    ["Subtotal", invoice.subtotal],
    ["Discount", invoice.discountTotal],
    ["Tax", invoice.taxTotal],
    ["Total", invoice.total],
  ];

  if (invoice.notes) rows.push(["Notes", invoice.notes]);
  return rows;
}

function itemRows(invoice: Invoice): ExportCell[][] {
  return [
    [
      "Item",
      "SKU",
      "HSN",
      "Unit",
      "Quantity",
      "Unit price",
      "Discount",
      "Tax rate %",
      "Taxable",
      "Tax",
      "Total",
    ],
    ...invoice.lines.map((line): ExportCell[] => [
      line.itemName,
      line.sku ?? "",
      line.hsnCode ?? "",
      line.unit,
      line.quantity,
      line.unitPrice,
      line.discount,
      line.taxRate,
      line.lineTaxable,
      line.lineTax,
      line.lineTotal,
    ]),
  ];
}

export function invoiceCsv(invoice: Invoice) {
  return rowsToCsv([
    ...summaryRows(invoice),
    [],
    ...itemRows(invoice),
  ]);
}

export function invoiceSheets(invoice: Invoice): ExportSheet[] {
  return [
    { name: "Invoice", rows: summaryRows(invoice), headerRows: [0] },
    { name: "Items", rows: itemRows(invoice), headerRows: [0] },
  ];
}

export function invoiceXlsx(invoice: Invoice) {
  return buildXlsx(invoiceSheets(invoice));
}

/** A short, human summary used by the share sheet and messaging links. */
export function shareText(invoice: Invoice) {
  const reference = invoice.number ?? `${kindLabel(invoice)} draft`;
  const lines = [
    `${kindLabel(invoice)} invoice ${reference}`,
    `${partyLabel(invoice)}: ${invoice.partyName}`,
    `Date: ${invoice.invoiceDate}`,
    `Total: ${plainMoney(invoice.total, invoice.currency)}`,
  ];
  return lines.join("\n");
}

export function binaryBlob(bytes: Uint8Array, type: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type });
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return url;
}
