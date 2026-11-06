import { useCallback, useEffect, useMemo, useState } from "react";

import PageHeader from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { dateTime, money, movementLabels, qty } from "@/lib/format";
import type { Movement } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Stock() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    api<Movement[]>("/api/merchant/movements?limit=200")
      .then(setMovements)
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return movements;
    return movements.filter(
      (movement) =>
        movement.productName.toLowerCase().includes(needle) ||
        (movementLabels[movement.type] ?? movement.type)
          .toLowerCase()
          .includes(needle),
    );
  }, [movements, filter]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock movements"
        description="Every change to on-hand stock, newest first."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <Input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter by product or reason"
        className="h-9 w-full sm:w-72"
      />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 text-right font-medium">Change</th>
              <th className="px-4 py-2.5 text-right font-medium">Unit cost</th>
              <th className="px-4 py-2.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((movement) => (
              <tr key={movement.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {dateTime(movement.createdAt)}
                </td>
                <td className="px-4 py-2.5 font-medium">{movement.productName}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    variant={
                      movement.quantity > 0 ? "success" : "secondary"
                    }
                  >
                    {movementLabels[movement.type] ?? movement.type}
                  </Badge>
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-medium tabular-nums",
                    movement.quantity > 0
                      ? "text-emerald-700"
                      : "text-destructive",
                  )}
                >
                  {movement.quantity > 0 ? "+" : ""}
                  {qty(movement.quantity)} {movement.unit}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {movement.unitCost === null ? "—" : money(movement.unitCost)}
                </td>
                <td className="max-w-56 truncate px-4 py-2.5 text-muted-foreground">
                  {movement.note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && visible.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            {movements.length === 0
              ? "No stock movements yet."
              : "No movements match this filter."}
          </p>
        ) : null}

        {loading && movements.length === 0 ? (
          <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : null}
      </div>
    </div>
  );
}
