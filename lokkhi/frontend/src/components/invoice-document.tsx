import { money, dateLabel } from "@/lib/format";
import type { Invoice, InvoiceLine } from "@/lib/types";

function hintFor(line: InvoiceLine) {
  if (line.lineStatus === "archived") {
    return (
      <span className="text-[11px] text-muted-foreground/70">Archived in Mushak</span>
    );
  }
  if (line.lineStatus === "missing") {
    return <span className="text-[11px] text-muted-foreground/70">Not in Mushak</span>;
  }
  return null;
}

/**
 * The invoice as a document.
 *
 * Shared by the signed-in detail page and the anonymous share page, so a shared
 * invoice looks exactly like the one the shop sees.
 */
export default function InvoiceDocument({
  invoice,
  onAddToMushak,
  onRetryStock,
  busy = false,
}: {
  invoice: Invoice;
  onAddToMushak?: (line: InvoiceLine) => void;
  onRetryStock?: (line: InvoiceLine) => void;
  busy?: boolean;
}) {
  const showHints = Boolean(onAddToMushak || onRetryStock);

  return (
    <article className="invoice-document overflow-hidden rounded-2xl border border-border bg-card">
      <header className="invoice-header flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
            {invoice.kind === "sale" ? "Sales invoice" : "Purchase invoice"}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {invoice.number ?? "Draft — not numbered yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {dateLabel(invoice.invoiceDate)}
            {invoice.dueDate ? ` · due ${dateLabel(invoice.dueDate)}` : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
            {invoice.kind === "sale" ? "Billed to" : "Supplier"}
          </p>
          <p className="font-medium">{invoice.partyName}</p>
          {invoice.partyPhone ? (
            <p className="text-muted-foreground">{invoice.partyPhone}</p>
          ) : null}
          {invoice.partyGstin ? (
            <p className="text-muted-foreground">GSTIN {invoice.partyGstin}</p>
          ) : null}
        </div>
      </header>

      <div className="invoice-table-wrap overflow-x-auto">
        <table className="invoice-table w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-6 py-2.5 font-medium">Item</th>
              <th className="px-3 py-2.5 font-medium">Qty</th>
              <th className="px-3 py-2.5 font-medium">Price</th>
              <th className="px-3 py-2.5 font-medium">Disc.</th>
              <th className="px-3 py-2.5 font-medium">Tax</th>
              <th className="px-6 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-t border-border/60 align-top">
                <td className="px-6 py-3">
                  <p className="font-medium">{line.itemName}</p>
                  <p className="text-xs text-muted-foreground/70">
                    {line.sku ? `${line.sku} · ` : ""}
                    {line.hsnCode ? `HSN ${line.hsnCode} · ` : ""}
                    {line.unit}
                  </p>
                  {showHints ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 print-hide">
                      {hintFor(line)}
                      {line.lineStatus === "missing" && onAddToMushak ? (
                        <>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <button
                            className="text-[11px] text-muted-foreground/70 underline decoration-border underline-offset-2 hover:text-muted-foreground"
                            onClick={() => onAddToMushak(line)}
                          >
                            Add to Mushak
                          </button>
                        </>
                      ) : null}

                      {line.stockSyncState === "failed" ? (
                        <>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <span className="text-[11px] text-muted-foreground/70">
                            Stock not updated
                          </span>
                          {onRetryStock ? (
                            <button
                              className="text-[11px] text-muted-foreground/70 underline decoration-border underline-offset-2 hover:text-muted-foreground disabled:opacity-50"
                              disabled={busy}
                              onClick={() => onRetryStock(line)}
                            >
                              Retry
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {showHints && line.stockSyncState === "failed" && line.stockSyncNote ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {line.stockSyncNote}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {line.quantity} {line.unit}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {money(line.unitPrice, invoice.currency)}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {line.discount
                    ? `−${money(line.discount, invoice.currency)}`
                    : "—"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {line.taxRate}% · {money(line.lineTax, invoice.currency)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {money(line.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="invoice-footer flex flex-wrap items-start justify-between gap-4 border-t border-border px-6 py-4">
        <div className="max-w-md text-sm text-muted-foreground">
          {invoice.notes ? <p>{invoice.notes}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground/70">
            Issued invoices keep the item names, prices and tax they were
            created with, even if Mushak changes later.
          </p>
        </div>

        <div className="invoice-totals w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {money(invoice.subtotal, invoice.currency)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span className="tabular-nums">
              {invoice.discountTotal > 0
                ? `−${money(invoice.discountTotal, invoice.currency)}`
                : money(0, invoice.currency)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span className="tabular-nums">
              {money(invoice.taxTotal, invoice.currency)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {money(invoice.total, invoice.currency)}
            </span>
          </div>
        </div>
      </footer>
    </article>
  );
}
