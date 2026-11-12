import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Input,
  Select,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { dateLabel, money } from "@/lib/format";
import type { InvoiceListItem, InvoiceStatus } from "@/lib/types";

type ListResponse = { total: number; items: InvoiceListItem[] };

function statusTone(status: InvoiceStatus) {
  if (status === "issued") return "green" as const;
  if (status === "void") return "red" as const;
  return "neutral" as const;
}

export default function InvoiceList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") ?? "";
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";

  const [search, setSearch] = useState(q);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    if (kind) query.set("kind", kind);
    if (status) query.set("status", status);
    if (q) query.set("q", q);

    api<ListResponse>(`/api/merchant/invoices?${query.toString()}`)
      .then((payload) => {
        if (!cancelled) setData(payload);
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
  }, [kind, status, q]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Sales and purchase invoices, issued or in progress.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/invoices/new?kind=sale")}>
            New sale
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/invoices/new?kind=purchase")}
          >
            New purchase
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print-hide">
        <Select
          value={kind}
          onChange={(event) => setFilter("kind", event.target.value)}
          className="w-36"
          aria-label="Filter by kind"
        >
          <option value="">All kinds</option>
          <option value="sale">Sales</option>
          <option value="purchase">Purchases</option>
        </Select>

        <Select
          value={status}
          onChange={(event) => setFilter("status", event.target.value)}
          className="w-36"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="draft">Drafts</option>
          <option value="issued">Issued</option>
          <option value="void">Void</option>
        </Select>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search number or party"
          className="w-64"
          aria-label="Search invoices"
        />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {!loading && items.length === 0 && !error ? (
        <EmptyState
          title="No invoices yet"
          description="Create a sale or purchase invoice. Items can be picked from Mushak or typed in freely — a missing product never blocks you."
          action={
            <Button onClick={() => navigate("/invoices/new?kind=sale")}>
              Create the first invoice
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Party</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Checks</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                  className="cursor-pointer border-t border-border/60 hover:bg-accent/60"
                >
                  <td className="px-4 py-3 font-medium">
                    {invoice.number ?? (
                      <span className="text-muted-foreground/70">Draft</span>
                    )}
                    <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                      {invoice.kind === "purchase" ? "Purchase" : "Sale"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {dateLabel(invoice.invoiceDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{invoice.partyName}</span>
                    {invoice.partyPhone ? (
                      <span className="block text-xs text-muted-foreground">
                        {invoice.partyPhone}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(invoice.total, invoice.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {invoice.manualItemCount > 0 ? (
                        <span className="text-xs text-muted-foreground/80">
                          {invoice.manualItemCount} manual{" "}
                          {invoice.manualItemCount === 1 ? "item" : "items"}
                        </span>
                      ) : null}
                      {invoice.stockFailedCount > 0 ? (
                        <Badge tone="amber">
                          {invoice.stockFailedCount} stock pending
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground/80">Loading invoices…</p>
      ) : null}
    </div>
  );
}
