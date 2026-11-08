import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import PageHeader from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/api";
import { dateTime, money, movementLabels, qty } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    api<DashboardData>("/api/merchant/dashboard")
      .then(setData)
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const currency = data?.value.currency ?? "INR";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          data?.merchant
            ? `${data.merchant.name} · today at a glance`
            : "Today at a glance"
        }
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!data && loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Inventory"
              value={String(data.counts.activeProducts)}
              hint={`${data.counts.products - data.counts.activeProducts} archived · ${data.counts.categories} categories`}
            />
            <StatCard
              title="Low stock"
              value={String(data.counts.lowStock)}
              hint={
                data.counts.lowStock > 0
                  ? "At or below the reorder level"
                  : "Nothing needs reordering"
              }
              tone={data.counts.lowStock > 0 ? "warning" : undefined}
            />
            <StatCard
              title="Stock value (cost)"
              value={money(data.value.cost, currency)}
              hint={`Retail ${money(data.value.retail, currency)}`}
            />
            <StatCard
              title="Today"
              value={`${qty(data.today.inQty)} in / ${qty(data.today.outQty)} out`}
              hint={`${data.today.movements} stock movements`}
            />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Needs reordering</CardTitle>
                <Link
                  to="/app/inventory?lowStock=1"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  All products
                </Link>
              </CardHeader>
              <CardContent>
                {data.lowStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No product is at its low-stock level.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {data.lowStock.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Reorder at {qty(item.reorderLevel)} {item.unit}
                          </p>
                        </div>
                        <Badge variant="warning">
                          {qty(item.stockQty)} {item.unit}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent stock movements</CardTitle>
                <Link
                  to="/app/stock"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Full history
                </Link>
              </CardHeader>
              <CardContent>
                {data.recentMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No stock movements yet. Add a product or record a purchase.
                  </p>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
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
    <Card>
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
