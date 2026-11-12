import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  Badge,
  Button,
  Dialog,
  ErrorNote,
  Field,
  Input,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { dateLabel, money } from "@/lib/format";
import type { Invoice, InvoiceLine } from "@/lib/types";

type MushakDraft = {
  name: string;
  sku: string;
  unit: string;
  hsnCode: string;
  taxRate: string;
  price: string;
};

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

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [mushakLine, setMushakLine] = useState<InvoiceLine | null>(null);
  const [mushakDraft, setMushakDraft] = useState<MushakDraft | null>(null);
  const [mushakError, setMushakError] = useState<string | null>(null);
  const [mushakBusy, setMushakBusy] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setInvoice(await api<Invoice>(`/api/merchant/invoices/${id}`));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(path: string) {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      setInvoice(
        await api<Invoice>(`/api/merchant/invoices/${invoice.id}/${path}`, {
          method: "POST",
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function openMushak(line: InvoiceLine) {
    setMushakLine(line);
    setMushakError(null);
    setMushakDraft({
      name: line.itemName,
      sku: line.sku ?? "",
      unit: line.unit,
      hsnCode: line.hsnCode ?? "",
      taxRate: String(line.taxRate),
      price: String(line.unitPrice),
    });
  }

  async function createInMushak() {
    if (!invoice || !mushakLine || !mushakDraft) return;

    setMushakBusy(true);
    setMushakError(null);

    try {
      const result = await api<{ invoice: Invoice }>(
        `/api/merchant/invoices/${invoice.id}/lines/${mushakLine.id}/add-to-mushak`,
        {
          method: "POST",
          body: {
            name: mushakDraft.name.trim(),
            sku: mushakDraft.sku.trim() || null,
            unit: mushakDraft.unit.trim() || "pcs",
            hsnCode: mushakDraft.hsnCode.trim() || null,
            taxRate: Number(mushakDraft.taxRate) || 0,
            price: Number(mushakDraft.price) || 0,
          },
        },
      );
      setInvoice(result.invoice);
      setMushakLine(null);
      setMushakDraft(null);
    } catch (cause) {
      setMushakError(errorMessage(cause));
    } finally {
      setMushakBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground/70">Loading invoice…</p>;
  }

  if (!invoice) {
    return (
      <div className="space-y-3">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to invoices
        </Button>
      </div>
    );
  }

  const title =
    invoice.number ?? `${invoice.kind === "sale" ? "Sale" : "Purchase"} draft`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print-hide">
        <div className="space-y-1">
          <button
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground"
            onClick={() => navigate("/")}
          >
            ← All invoices
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <Badge
              tone={
                invoice.status === "issued"
                  ? "green"
                  : invoice.status === "void"
                    ? "red"
                    : "neutral"
              }
            >
              {invoice.status}
            </Badge>
            <Badge tone="blue">
              {invoice.kind === "sale" ? "Sale" : "Purchase"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.status === "draft" ? (
            <>
              <Button
                variant="outline"
                onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
              >
                Edit draft
              </Button>
              <Button onClick={() => act("issue")} disabled={busy}>
                Issue invoice
              </Button>
            </>
          ) : null}

          {invoice.status === "issued" ? (
            <>
              <Button variant="outline" onClick={() => window.print()}>
                Print
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Void this invoice? Stock movements will be reversed.")) {
                    void act("void");
                  }
                }}
              >
                Void
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <article className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 print-hide">
                      {hintFor(line)}
                      {line.lineStatus === "missing" ? (
                        <>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <button
                            className="text-[11px] text-muted-foreground/70 underline decoration-border underline-offset-2 hover:text-muted-foreground"
                            onClick={() => openMushak(line)}
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
                          <button
                            className="text-[11px] text-muted-foreground/70 underline decoration-border underline-offset-2 hover:text-muted-foreground disabled:opacity-50"
                            disabled={busy}
                            onClick={() => act(`lines/${line.id}/retry-stock`)}
                          >
                            Retry
                          </button>
                        </>
                      ) : null}
                    </div>
                    {line.stockSyncState === "failed" && line.stockSyncNote ? (
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

        <footer className="flex flex-wrap items-start justify-between gap-4 border-t border-border px-6 py-4">
          <div className="max-w-md text-sm text-muted-foreground">
            {invoice.notes ? <p>{invoice.notes}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground/70">
              Issued invoices keep the item names, prices and tax they were
              created with, even if Mushak changes later.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-1 text-sm">
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

      <Dialog
        open={Boolean(mushakLine && mushakDraft)}
        onClose={() => {
          setMushakLine(null);
          setMushakDraft(null);
        }}
        title="Add to Mushak"
        description="Creates a catalogue item and links this line. The invoice keeps its original snapshot and totals."
      >
        {mushakDraft ? (
          <div className="space-y-3">
            {mushakError ? <ErrorNote>{mushakError}</ErrorNote> : null}

            <Field label="Product name">
              <Input
                value={mushakDraft.name}
                onChange={(event) =>
                  setMushakDraft({ ...mushakDraft, name: event.target.value })
                }
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU" hint="Blank lets Mushak assign one later">
                <Input
                  value={mushakDraft.sku}
                  onChange={(event) =>
                    setMushakDraft({ ...mushakDraft, sku: event.target.value })
                  }
                />
              </Field>
              <Field label="Unit">
                <Input
                  value={mushakDraft.unit}
                  onChange={(event) =>
                    setMushakDraft({ ...mushakDraft, unit: event.target.value })
                  }
                />
              </Field>
              <Field label="HSN code" hint="Optional">
                <Input
                  value={mushakDraft.hsnCode}
                  onChange={(event) =>
                    setMushakDraft({
                      ...mushakDraft,
                      hsnCode: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Tax rate %">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={mushakDraft.taxRate}
                  onChange={(event) =>
                    setMushakDraft({
                      ...mushakDraft,
                      taxRate: event.target.value,
                    })
                  }
                />
              </Field>
            </div>

            <Field
              label={invoice.kind === "sale" ? "Selling price" : "Purchase price"}
              hint="Suggestion for future Mushak use; this invoice does not change"
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={mushakDraft.price}
                onChange={(event) =>
                  setMushakDraft({ ...mushakDraft, price: event.target.value })
                }
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => {
                  setMushakLine(null);
                  setMushakDraft(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={createInMushak} disabled={mushakBusy}>
                {mushakBusy ? "Creating…" : "Create and link"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
