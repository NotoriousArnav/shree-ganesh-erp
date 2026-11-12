import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  invoiceLineTotals,
  invoiceTotals,
  quantityError,
  unitStep,
} from "@ganesh/shared";

import {
  Badge,
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { money, todayIso } from "@/lib/format";
import type {
  Invoice,
  InvoiceKind,
  InvoiceLinePayload,
  InvoicePayload,
  Suggestion,
} from "@/lib/types";

type DraftLine = {
  key: string;
  catalogueItemId: string | null;
  itemName: string;
  sku: string;
  hsnCode: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
};

const units = ["pcs", "kg", "g", "litre", "ml", "box", "packet", "dozen"];

let lineSeq = 0;

function newLine(): DraftLine {
  lineSeq += 1;
  return {
    key: `line-${lineSeq}`,
    catalogueItemId: null,
    itemName: "",
    sku: "",
    hsnCode: "",
    unit: "pcs",
    quantity: "1",
    unitPrice: "",
    discount: "0",
    taxRate: "0",
  };
}

function toDraft(line: Invoice["lines"][number]): DraftLine {
  lineSeq += 1;
  return {
    key: `line-${lineSeq}`,
    catalogueItemId: line.catalogueItemId,
    itemName: line.itemName,
    sku: line.sku ?? "",
    hsnCode: line.hsnCode ?? "",
    unit: line.unit,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    discount: String(line.discount),
    taxRate: String(line.taxRate),
  };
}

export default function InvoiceEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();

  const [kind, setKind] = useState<InvoiceKind>(
    params.get("kind") === "purchase" ? "purchase" : "sale",
  );
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [partyGstin, setPartyGstin] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);

  const [suggestFor, setSuggestFor] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestFailed, setSuggestFailed] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    api<Invoice>(`/api/merchant/invoices/${id}`)
      .then((invoice) => {
        if (cancelled) return;
        if (invoice.status !== "draft") {
          navigate(`/invoices/${invoice.id}`, { replace: true });
          return;
        }
        setKind(invoice.kind);
        setInvoiceDate(invoice.invoiceDate);
        setDueDate(invoice.dueDate ?? "");
        setPartyName(invoice.partyName);
        setPartyPhone(invoice.partyPhone ?? "");
        setPartyGstin(invoice.partyGstin ?? "");
        setNotes(invoice.notes ?? "");
        setLines(invoice.lines.length ? invoice.lines.map(toDraft) : [newLine()]);
      })
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const activeName =
    lines.find((line) => line.key === suggestFor)?.itemName ?? "";

  useEffect(() => {
    if (!suggestFor || activeName.trim().length < 2) {
      setSuggestions([]);
      setSuggestFailed(false);
      setSuggestLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestLoading(true);

    const timer = setTimeout(() => {
      api<Suggestion[]>(
        `/api/merchant/invoices/suggestions?q=${encodeURIComponent(activeName.trim())}`,
      )
        .then((result) => {
          if (cancelled) return;
          setSuggestions(result);
          setSuggestFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setSuggestFailed(true);
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [suggestFor, activeName]);

  const totals = useMemo(
    () =>
      invoiceTotals(
        lines.map((line) => ({
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
          discount: Number(line.discount) || 0,
          taxRate: Number(line.taxRate) || 0,
        })),
      ),
    [lines],
  );

  function updateLine(key: string, changes: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
  }

  function pickSuggestion(key: string, suggestion: Suggestion) {
    updateLine(key, {
      catalogueItemId: suggestion.id,
      itemName: suggestion.name,
      sku: suggestion.sku ?? "",
      hsnCode: suggestion.hsnCode ?? "",
      unit: suggestion.unit,
      taxRate: String(suggestion.taxRate),
      unitPrice: String(
        kind === "sale" ? suggestion.sellingPrice : suggestion.purchasePrice,
      ),
    });
    setSuggestFor(null);
  }

  function buildPayload(): InvoicePayload | string {
    if (!partyName.trim()) return "Enter the party name.";

    const payloadLines: InvoiceLinePayload[] = [];

    for (const line of lines) {
      if (!line.itemName.trim() && !Number(line.unitPrice)) continue;
      if (!line.itemName.trim()) return "Every used line needs an item name.";
      const quantityMessage = quantityError(
        line.unit,
        Number(line.quantity),
      );
      if (quantityMessage) {
        return `“${line.itemName}”: ${quantityMessage}.`;
      }

      payloadLines.push({
        catalogueItemId: line.catalogueItemId,
        itemName: line.itemName.trim(),
        sku: line.sku.trim() || null,
        hsnCode: line.hsnCode.trim() || null,
        unit: line.unit,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice) || 0,
        discount: Number(line.discount) || 0,
        taxRate: Number(line.taxRate) || 0,
      });
    }

    if (payloadLines.length === 0) return "Add at least one item.";

    return {
      kind,
      invoiceDate,
      dueDate: dueDate || null,
      partyName: partyName.trim(),
      partyPhone: partyPhone.trim() || null,
      partyGstin: partyGstin.trim() || null,
      notes: notes.trim() || null,
      lines: payloadLines,
    };
  }

  async function save(issue: boolean) {
    const payload = buildPayload();
    if (typeof payload === "string") {
      setError(payload);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      let invoiceId = id;

      if (invoiceId) {
        await api<Invoice>(`/api/merchant/invoices/${invoiceId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        const created = await api<Invoice>("/api/merchant/invoices", {
          method: "POST",
          body: payload,
        });
        invoiceId = created.id;
      }

      if (issue) {
        await api<Invoice>(`/api/merchant/invoices/${invoiceId}/issue`, {
          method: "POST",
        });
      }

      navigate(`/invoices/${invoiceId}`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground/70">Loading invoice…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {id ? "Edit draft" : "New invoice"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Mushak suggestions are optional. Type anything if the product is not
            in Mushak.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(id ? `/invoices/${id}` : "/")}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button variant="outline" onClick={() => save(false)} disabled={busy}>
            Save draft
          </Button>
          <Button onClick={() => save(true)} disabled={busy}>
            {busy ? "Saving…" : "Save & issue"}
          </Button>
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Kind">
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as InvoiceKind)}
          >
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
          </Select>
        </Field>

        <Field label="Invoice date">
          <Input
            type="date"
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
          />
        </Field>

        <Field label="Due date" hint="Optional">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>

        <Field
          label={kind === "sale" ? "Customer" : "Supplier"}
          required
          hint="Name is required; phone is optional"
        >
          <Input
            value={partyName}
            onChange={(event) => setPartyName(event.target.value)}
            placeholder={kind === "sale" ? "Walk-in customer" : "Supplier name"}
            required
          />
        </Field>

        <Field label="Phone" hint="Optional, shown next to the name">
          <Input
            value={partyPhone}
            onChange={(event) => setPartyPhone(event.target.value)}
            placeholder="98765 43210"
          />
        </Field>

        <Field label="GSTIN" hint="Optional">
          <Input
            value={partyGstin}
            onChange={(event) => setPartyGstin(event.target.value)}
            placeholder="22AAAAA0000A1Z5"
          />
        </Field>

        <Field label="Notes" hint="Printed on the invoice" className="sm:col-span-2">
          <Textarea
            rows={1}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div>
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Item</th>
                <th className="w-24 px-2 py-2.5 font-medium">Qty</th>
                <th className="w-24 px-2 py-2.5 font-medium">Unit</th>
                <th className="w-28 px-2 py-2.5 font-medium">Price</th>
                <th className="w-24 px-2 py-2.5 font-medium">Disc.</th>
                <th className="w-20 px-2 py-2.5 font-medium">Tax %</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">Total</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const lineTotals = invoiceLineTotals({
                  quantity: Number(line.quantity) || 0,
                  unitPrice: Number(line.unitPrice) || 0,
                  discount: Number(line.discount) || 0,
                  taxRate: Number(line.taxRate) || 0,
                });
                const showSuggestions =
                  suggestFor === line.key && activeName.trim().length >= 2;

                return (
                  <tr key={line.key} className="border-t border-border/60">
                    <td className="px-3 py-2 align-top">
                      <div className="relative">
                        <Input
                          value={line.itemName}
                          onChange={(event) => {
                            updateLine(line.key, {
                              itemName: event.target.value,
                              catalogueItemId: null,
                            });
                            setSuggestFor(line.key);
                          }}
                          onFocus={() => setSuggestFor(line.key)}
                          onBlur={() => {
                            // Let a click on a suggestion land first.
                            setTimeout(() => setSuggestFor(null), 120);
                          }}
                          placeholder="Start typing or enter any item"
                          autoComplete="off"
                        />
                        {line.catalogueItemId ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            Linked to Mushak
                          </span>
                        ) : line.itemName.trim() ? (
                          <span className="mt-1 block text-[11px] text-muted-foreground/70">
                            Manual item — saved with this invoice only
                          </span>
                        ) : null}

                        {showSuggestions ? (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                            {suggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  pickSuggestion(line.key, suggestion);
                                }}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60"
                              >
                                <span>
                                  <span className="font-medium">
                                    {suggestion.name}
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground/70">
                                    {suggestion.sku ?? "no SKU"}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {money(
                                    kind === "sale"
                                      ? suggestion.sellingPrice
                                      : suggestion.purchasePrice,
                                  )}{" "}
                                  · {suggestion.stockQty} {suggestion.unit}
                                </span>
                              </button>
                            ))}

                            {suggestLoading ? (
                              <p className="px-3 py-2 text-xs text-muted-foreground/70">
                                Searching Mushak…
                              </p>
                            ) : null}

                            {!suggestLoading && suggestions.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                {suggestFailed ? (
                                  "Mushak suggestions unavailable — you can still add this item."
                                ) : (
                                  <>
                                    <p>No match in Mushak.</p>
                                    <button
                                      type="button"
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        setSuggestFor(null);
                                      }}
                                      className="mt-1 text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground"
                                    >
                                      Use “{activeName.trim()}” as a manual item
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        min={unitStep(line.unit)}
                        step={unitStep(line.unit)}
                        inputMode={
                          unitStep(line.unit) === 1 ? "numeric" : "decimal"
                        }
                        value={line.quantity}
                        aria-invalid={Boolean(
                          quantityError(line.unit, Number(line.quantity)),
                        )}
                        title={quantityError(
                          line.unit,
                          Number(line.quantity),
                        ) ?? undefined}
                        onChange={(event) =>
                          updateLine(line.key, { quantity: event.target.value })
                        }
                      />
                    </td>

                    <td className="px-2 py-2 align-top">
                      <Select
                        value={line.unit}
                        onChange={(event) => {
                          const unit = event.target.value;
                          // Switching to a counted unit rounds off any
                          // fractional quantity left over from a measured one.
                          const quantity =
                            unitStep(unit) === 1
                              ? String(Math.round(Number(line.quantity) || 0) || 1)
                              : line.quantity;
                          updateLine(line.key, { unit, quantity });
                        }}
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </Select>
                    </td>

                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateLine(line.key, { unitPrice: event.target.value })
                        }
                      />
                    </td>

                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(event) =>
                          updateLine(line.key, { discount: event.target.value })
                        }
                      />
                    </td>

                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={line.taxRate}
                        onChange={(event) =>
                          updateLine(line.key, { taxRate: event.target.value })
                        }
                      />
                    </td>

                    <td className="px-2 py-2 text-right align-top tabular-nums">
                      {money(lineTotals.lineTotal)}
                    </td>

                    <td className="px-2 py-2 align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Remove line"
                        onClick={() =>
                          setLines((current) =>
                            current.length === 1
                              ? [newLine()]
                              : current.filter((item) => item.key !== line.key),
                          )
                        }
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLines((current) => [...current, newLine()])}
          >
            Add line
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge tone="neutral">Tax exclusive</Badge>
            <span>Tax is added on top of the line total.</span>
          </div>
        </div>
      </div>

      <div className="ml-auto w-full max-w-sm space-y-1.5 rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{money(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Discount</span>
          <span className="tabular-nums">
            {totals.discountTotal > 0
              ? `−${money(totals.discountTotal)}`
              : money(0)}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Tax</span>
          <span className="tabular-nums">{money(totals.taxTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{money(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
