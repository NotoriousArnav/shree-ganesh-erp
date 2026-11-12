import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import PageHeader from "@/components/page-header";
import RangeField from "@/components/range-field";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { dateTime, money, movementLabels, qty } from "@/lib/format";
import {
  downloadReportCsv,
  downloadReportJson,
  downloadReportXlsx,
} from "@/lib/report-export";
import {
  formatBound,
  formatFluent,
  formatRangeLabel,
  lastDaysRange,
  rangeQuery,
} from "@/lib/range";
import type { EpochRange, ShopReportData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Printable shop report.
 *
 * The page itself is the preview: `window.print()` shows the browser dialog,
 * where "Save as PDF" produces the same content with the chrome hidden by the
 * `print:` rules in index.css.
 */
export default function Report() {
  const [range, setRange] = useState<EpochRange>(() => lastDaysRange(30));
  const [data, setData] = useState<ShopReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      api<ShopReportData>(`/api/merchant/report?${rangeQuery(range)}`)
        .then((next) => {
          if (!cancelled) setData(next);
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(errorMessage(cause));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [range.from, range.to, reloadToken]);

  // Give the printed page and the saved PDF a useful title.
  useEffect(() => {
    const previous = document.title;
    const shopName = data?.merchant?.name ?? "Shop";
    document.title = `${shopName} report — ${formatRangeLabel(range)}`;

    return () => {
      document.title = previous;
    };
  }, [data?.merchant?.name, range.from, range.to]);

  const heading = useMemo(() => {
    return data?.merchant?.name ? `${data.merchant.name} — Shop report` : "Shop report";
  }, [data?.merchant?.name]);

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <PageHeader
          title="Report"
          description="A printable and downloadable summary of your shop for any date range."
          actions={
            <>
              <Button variant="outline" asChild>
                <Link to="/app">Back to dashboard</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => setReloadToken((token) => token + 1)}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
              <Button
                variant="outline"
                onClick={() => data && downloadReportCsv(data)}
                disabled={!data}
                aria-label="Download CSV files as a ZIP"
                title="Download one CSV per report section, inside a ZIP"
              >
                <DownloadIcon />
                CSV ZIP
              </Button>
              <Button
                variant="outline"
                onClick={() => data && downloadReportXlsx(data)}
                disabled={!data}
                aria-label="Download report as XLSX"
                title="Download the report as an Excel workbook"
              >
                <DownloadIcon />
                XLSX
              </Button>
              <Button
                variant="outline"
                onClick={() => data && downloadReportJson(data)}
                disabled={!data}
                aria-label="Download report as JSON"
                title="Download the report data as JSON"
              >
                <DownloadIcon />
                JSON
              </Button>
              <Button onClick={() => window.print()} disabled={!data}>
                <PrinterIcon />
                Print
              </Button>
            </>
          }
        />

        <div className="mt-5 rounded-xl border bg-card p-4">
          <RangeField value={range} onChange={setRange} />
          <p className="mt-3 text-xs text-muted-foreground">
            The report uses the same range for movements and the printed
            heading. Stock totals and valuation are current as at{" "}
            {data ? dateTime(data.generatedAt) : "—"}.
          </p>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {!data && loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading report…</p>
        ) : null}
      </div>

      {data ? <ReportDocument data={data} heading={heading} /> : null}
    </div>
  );
}

function ReportDocument({
  data,
  heading,
}: {
  data: ShopReportData;
  heading: string;
}) {
  const merchant = data.merchant;
  const currency = data.value.currency;
  const address = merchant?.address;

  return (
    <article className="rounded-xl border bg-background p-6 print:rounded-none print:border-0 print:p-0">
      <header className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {[address?.line1, address?.line2, address?.city, address?.state,
                address?.pincode]
                .filter(Boolean)
                .join(", ") || "No address on file"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                merchant?.phone ? `Phone ${merchant.phone}` : null,
                merchant?.gstin ? `GSTIN ${merchant.gstin}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "No contact details on file"}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">Generated</p>
            <p className="text-muted-foreground">{dateTime(data.generatedAt)}</p>
            <p className="mt-1 text-muted-foreground">by {data.generatedBy}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              From
            </p>
            <p>{formatFluent(data.range.from)}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatBound(data.range.from)}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              To
            </p>
            <p>{formatFluent(data.range.to)}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatBound(data.range.to)}
            </p>
          </div>
        </div>
      </header>

      <section className="mt-5">
        <SectionTitle>Summary</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Active products" value={String(data.counts.activeProducts)} />
          <Stat label="Categories" value={String(data.counts.categories)} />
          <Stat
            label="Movements in range"
            value={String(data.period.movements)}
          />
          <Stat
            label="Quantity in / out"
            value={`${qty(data.period.inQty)} / ${qty(data.period.outQty)}`}
          />
        </div>
      </section>

      <section className="mt-5">
        <SectionTitle>Stock value</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="At cost" value={money(data.value.cost, currency)} />
          <Stat label="At retail" value={money(data.value.retail, currency)} />
          <Stat label="Potential margin" value={money(data.value.margin, currency)} />
          <Stat
            label="Low-stock products"
            value={String(data.counts.lowStock)}
          />
        </div>
      </section>

      <section className="mt-5">
        <SectionTitle>Stock health</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Healthy" value={String(data.stockHealth.healthy)} />
          <Stat label="Low" value={String(data.stockHealth.low)} />
          <Stat label="Out of stock" value={String(data.stockHealth.outOfStock)} />
        </div>
      </section>

      <section className="mt-5 break-inside-avoid">
        <SectionTitle>Category valuation</SectionTitle>
        <Table
          columns={["Category", "Products", "Cost", "Retail"]}
          align={["left", "right", "right", "right"]}
          empty="No categories yet."
          rows={data.categories.map((row) => [
            row.name,
            String(row.products),
            money(row.cost, currency),
            money(row.retail, currency),
          ])}
        />
      </section>

      <section className="mt-5 break-inside-avoid">
        <SectionTitle>Needs reordering</SectionTitle>
        <Table
          columns={["Product", "Stock", "Reorder at", "Unit"]}
          align={["left", "right", "right", "left"]}
          empty="No product is at its low-stock level."
          rows={data.lowStock.map((row) => [
            row.name,
            qty(row.stockQty),
            qty(row.reorderLevel),
            row.unit,
          ])}
        />
      </section>

      <section className="mt-5 break-inside-avoid">
        <SectionTitle>Out of stock</SectionTitle>
        <Table
          columns={["Product", "Stock", "Unit", "Last updated"]}
          align={["left", "right", "left", "right"]}
          empty="Nothing is out of stock."
          rows={data.outOfStock.map((row) => [
            row.name,
            qty(row.stockQty),
            row.unit,
            dateTime(row.updatedAt),
          ])}
        />
      </section>

      <section className="mt-5 break-inside-avoid">
        <SectionTitle>Top stock value</SectionTitle>
        <Table
          columns={["Product", "On hand", "Cost", "Retail"]}
          align={["left", "right", "right", "right"]}
          empty="No stock on hand right now."
          rows={data.topValue.map((row) => [
            row.name,
            `${qty(row.stockQty)} ${row.unit}`,
            money(row.cost, currency),
            money(row.retail, currency),
          ])}
        />
      </section>

      <section className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>
            Stock movements ({data.movementTotal})
          </SectionTitle>
          {data.truncated ? (
            <p className="text-xs text-muted-foreground">
              Showing the most recent {data.movements.length} of{" "}
              {data.movementTotal}. Narrow the range for the full list.
            </p>
          ) : null}
        </div>
        <Table
          columns={["When", "Product", "Type", "Change", "Note"]}
          align={["left", "left", "left", "right", "left"]}
          empty="No stock movements in the selected range."
          rows={data.movements.map((row) => [
            dateTime(row.createdAt),
            row.productName,
            movementLabels[row.type] ?? row.type,
            `${row.quantity > 0 ? "+" : ""}${qty(row.quantity)} ${row.unit}`,
            row.note ?? "—",
          ])}
        />
      </section>

      <footer className="mt-6 border-t pt-3 text-xs text-muted-foreground">
        <p>
          Mushak shop report · {formatRangeLabel(data.range)} · generated{" "}
          {dateTime(data.generatedAt)}
        </p>
      </footer>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 print:rounded-none print:bg-transparent">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Table({
  columns,
  align,
  rows,
  empty,
}: {
  columns: string[];
  align: Array<"left" | "right">;
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            {columns.map((column, index) => (
              <th
                key={column}
                className={cn(
                  "py-1.5 pr-3 text-xs font-medium uppercase tracking-wide text-muted-foreground last:pr-0",
                  align[index] === "right" && "text-right",
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "py-1.5 pr-3 align-top last:pr-0",
                    align[cellIndex] === "right" && "text-right tabular-nums",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" rx="1" />
    </svg>
  );
}
