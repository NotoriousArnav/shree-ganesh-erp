import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateTime, money, movementLabels, qty } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WidgetSpan = "kpi" | "half";

export type DashboardWidget = {
  id: string;
  title: string;
  span: WidgetSpan;
  render: (data: DashboardData) => React.ReactNode;
};

/**
 * The dashboard widget registry.
 *
 * Adding a widget here makes it available to every existing layout: unknown ids
 * are appended when a saved order is loaded, so no migration is needed.
 */
export const dashboardWidgets: DashboardWidget[] = [
  {
    id: "inventory",
    title: "Inventory",
    span: "kpi",
    render: (data) => (
      <KpiCard
        title="Inventory"
        value={String(data.counts.activeProducts)}
        hint={`${data.counts.products - data.counts.activeProducts} archived · ${data.counts.categories} categories`}
      />
    ),
  },
  {
    id: "low-stock",
    title: "Low stock",
    span: "kpi",
    render: (data) => (
      <KpiCard
        title="Low stock"
        value={String(data.counts.lowStock)}
        hint={
          data.counts.lowStock > 0
            ? "At or below the reorder level"
            : "Nothing needs reordering"
        }
        tone={data.counts.lowStock > 0 ? "warning" : undefined}
      />
    ),
  },
  {
    id: "stock-value",
    title: "Stock value",
    span: "kpi",
    render: (data) => (
      <KpiCard
        title="Stock value (cost)"
        value={money(data.value.cost, data.value.currency)}
        hint={`Retail ${money(data.value.retail, data.value.currency)} · Margin ${money(
          data.value.margin,
          data.value.currency,
        )}`}
      />
    ),
  },
  {
    id: "period-movements",
    title: "Movements in range",
    span: "kpi",
    render: (data) => (
      <KpiCard
        title="Movements in range"
        value={`${qty(data.period.inQty)} in / ${qty(data.period.outQty)} out`}
        hint={`${data.period.movements} stock movements`}
      />
    ),
  },
  {
    id: "stock-health",
    title: "Stock health",
    span: "half",
    render: (data) => <StockHealthCard data={data} />,
  },
  {
    id: "movement-trend",
    title: "Movement trend",
    span: "half",
    render: (data) => <MovementTrendCard data={data} />,
  },
  {
    id: "needs-reordering",
    title: "Needs reordering",
    span: "half",
    render: (data) => (
      <ListCard
        title="Needs reordering"
        action={{ to: "/app/inventory?lowStock=1", label: "All products" }}
        empty="No product is at its low-stock level."
        hasContent={data.lowStock.length > 0}
      >
        <ul className="divide-y">
          {data.lowStock.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  Reorder at {qty(item.reorderLevel)} {item.unit}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {qty(item.stockQty)} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      </ListCard>
    ),
  },
  {
    id: "recent-movements",
    title: "Recent movements",
    span: "half",
    render: (data) => (
      <ListCard
        title="Recent movements"
        action={{ to: "/app/stock", label: "Full history" }}
        empty="No stock movements in the selected range."
        hasContent={data.recentMovements.length > 0}
      >
        <ul className="divide-y">
          {data.recentMovements.map((movement) => (
            <li
              key={movement.id}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {movement.productName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {movementLabels[movement.type] ?? movement.type} ·{" "}
                  {dateTime(movement.createdAt)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  movement.quantity > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-destructive",
                )}
              >
                {movement.quantity > 0 ? "+" : ""}
                {qty(movement.quantity)} {movement.unit}
              </span>
            </li>
          ))}
        </ul>
      </ListCard>
    ),
  },
  {
    id: "category-value",
    title: "Category value",
    span: "half",
    render: (data) => <CategoryValueCard data={data} />,
  },
  {
    id: "top-value",
    title: "Top stock value",
    span: "half",
    render: (data) => <TopValueCard data={data} />,
  },
];

export const dashboardWidgetIds = dashboardWidgets.map((widget) => widget.id);

function KpiCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone?: "warning";
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-1">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            tone === "warning" && "text-amber-700 dark:text-amber-400",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ListCard({
  title,
  action,
  empty,
  hasContent,
  children,
}: {
  title: string;
  action?: { to: string; label: string };
  empty: string;
  hasContent: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {action ? (
          <Link
            to={action.to}
            className="text-xs text-primary underline underline-offset-2"
          >
            {action.label}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {hasContent ? (
          children
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StockHealthCard({ data }: { data: DashboardData }) {
  const { healthy, low, outOfStock } = data.stockHealth;
  const total = healthy + low + outOfStock;
  const percent = (value: number) => (total === 0 ? 0 : (value / total) * 100);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Stock health</CardTitle>
        <span className="text-xs text-muted-foreground">
          {data.counts.activeProducts} active products
        </span>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a product to see how stocked the shop is.
          </p>
        ) : (
          <>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${healthy} healthy, ${low} low, ${outOfStock} out of stock`}
            >
              <div
                className="bg-emerald-500"
                style={{ width: `${percent(healthy)}%` }}
              />
              <div className="bg-amber-500" style={{ width: `${percent(low)}%` }} />
              <div
                className="bg-rose-500"
                style={{ width: `${percent(outOfStock)}%` }}
              />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Healthy</dt>
                <dd className="text-lg font-semibold tabular-nums">{healthy}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Low</dt>
                <dd className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {low}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Out</dt>
                <dd className="text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                  {outOfStock}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MovementTrendCard({ data }: { data: DashboardData }) {
  const series = data.period.series;
  const hasMovement = series.some(
    (point) => point.inQty > 0 || point.outQty > 0,
  );
  const max = Math.max(1, ...series.map((point) => Math.max(point.inQty, point.outQty)));

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Movement trend</CardTitle>
        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-500" /> In
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-rose-500" /> Out
          </span>
        </span>
      </CardHeader>
      <CardContent>
        {!hasMovement ? (
          <p className="text-sm text-muted-foreground">
            No movements in the selected range.
          </p>
        ) : (
          <>
            <div className="flex h-28 items-end gap-[2px]" aria-hidden="true">
              {series.map((point) => (
                <div
                  key={point.date}
                  className="flex h-full min-w-0 flex-1 items-end justify-center gap-[1px]"
                  title={`${shortDay(point.date)}: +${qty(point.inQty)} in, ${qty(
                    point.outQty,
                  )} out`}
                >
                  <div
                    className="w-1/2 rounded-t bg-emerald-500/80"
                    style={{
                      height: point.inQty > 0 ? `${barHeight(point.inQty, max)}%` : 0,
                    }}
                  />
                  <div
                    className="w-1/2 rounded-t bg-rose-500/80"
                    style={{
                      height: point.outQty > 0 ? `${barHeight(point.outQty, max)}%` : 0,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{shortDay(series[0].date)}</span>
              <span>{shortDay(series[series.length - 1].date)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function barHeight(value: number, max: number) {
  return Math.max((value / max) * 100, 3);
}

function shortDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

function CategoryValueCard({ data }: { data: DashboardData }) {
  const totalRetail = data.categories.reduce((sum, row) => sum + row.retail, 0);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Category value</CardTitle>
        <span className="text-xs text-muted-foreground">
          {money(totalRetail, data.value.currency)} retail
        </span>
      </CardHeader>
      <CardContent>
        {data.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-1.5 font-medium">Category</th>
                  <th className="pb-1.5 text-right font-medium">Products</th>
                  <th className="pb-1.5 text-right font-medium">Retail</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((row) => (
                  <tr key={row.id ?? "uncategorised"} className="border-t">
                    <td className="py-1.5 pr-2">{row.name}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.products}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {money(row.retail, data.value.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopValueCard({ data }: { data: DashboardData }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Top stock value</CardTitle>
        <Link
          to="/app/inventory"
          className="text-xs text-primary underline underline-offset-2"
        >
          Inventory
        </Link>
      </CardHeader>
      <CardContent>
        {data.topValue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No stock on hand right now.
          </p>
        ) : (
          <ul className="divide-y">
            {data.topValue.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {qty(item.stockQty)} {item.unit} on hand
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {money(item.retail, data.value.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
