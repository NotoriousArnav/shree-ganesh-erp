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
import ExportDialog from "@/components/export-dialog";
import InvoiceDocument from "@/components/invoice-document";
import { api, errorMessage } from "@/lib/api";
import type { Invoice, InvoiceLine } from "@/lib/types";

type MushakDraft = {
  name: string;
  sku: string;
  unit: string;
  hsnCode: string;
  taxRate: string;
  price: string;
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

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
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            Export
          </Button>

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

      <InvoiceDocument
        invoice={invoice}
        busy={busy}
        onAddToMushak={openMushak}
        onRetryStock={(line) => act(`lines/${line.id}/retry-stock`)}
      />

      {exportOpen ? (
        <ExportDialog invoice={invoice} onClose={() => setExportOpen(false)} />
      ) : null}

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
