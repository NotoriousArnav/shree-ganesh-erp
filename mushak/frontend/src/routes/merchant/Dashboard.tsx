import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import DashboardGrid from "@/components/dashboard/dashboard-grid";
import { dashboardWidgetIds } from "@/components/dashboard/dashboard-widgets";
import PageHeader from "@/components/page-header";
import RangeField from "@/components/range-field";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import {
  clearLayout,
  loadLayout,
  saveLayout,
  type DashboardLayout,
} from "@/lib/dashboard-layout";
import { formatRangeLabel, rangeQuery, shiftRange, todayRange } from "@/lib/range";
import type { DashboardData, EpochRange } from "@/lib/types";

export default function Dashboard() {
  const [range, setRange] = useState<EpochRange>(() => todayRange());
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [customising, setCustomising] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>({
    order: [...dashboardWidgetIds],
    hidden: [],
  });

  const merchantId = data?.merchant?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      api<DashboardData>(`/api/merchant/dashboard?${rangeQuery(range)}`)
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

  useEffect(() => {
    if (!merchantId) return;
    setLayout(loadLayout(merchantId, dashboardWidgetIds));
  }, [merchantId]);

  const updateLayout = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      saveLayout(merchantId, next);
    },
    [merchantId],
  );

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  function reorder(order: string[]) {
    updateLayout({ ...layout, order });
  }

  function toggleHidden(id: string) {
    const hidden = layout.hidden.includes(id)
      ? layout.hidden.filter((entry) => entry !== id)
      : [...layout.hidden, id];
    updateLayout({ ...layout, hidden });
  }

  function resetLayout() {
    clearLayout(merchantId);
    setLayout({ order: [...dashboardWidgetIds], hidden: [] });
  }

  const swipe = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (customising || event.pointerType === "mouse") return;

    const target = event.target as HTMLElement;
    if (
      target.closest(
        "input, button, a, select, textarea, [role='button'], [data-no-swipe]",
      )
    ) {
      return;
    }

    swipe.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    setRange((current) => shiftRange(current, dx < 0 ? 1 : -1));
  }

  const periodLabel = useMemo(() => formatRangeLabel(range), [range]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={
          data?.merchant
            ? `${data.merchant.name} · ${periodLabel}`
            : "Your shop at a glance"
        }
        actions={
          <>
            <Button
              variant={customising ? "default" : "outline"}
              onClick={() => setCustomising((value) => !value)}
            >
              {customising ? "Done" : "Customise"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/report">
                <PrinterIcon />
                Report
              </Link>
            </Button>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card p-4">
        <RangeField value={range} onChange={setRange} />
        <p className="mt-3 text-xs text-muted-foreground">
          Stock levels and valuation are current. Movement widgets cover the
          selected range. On a phone, swipe left or right to move the window.
        </p>
      </div>

      {customising ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-background px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Drag widgets to rearrange them, or hide the ones this shop does not
            use.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={resetLayout}>
            Reset layout
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!data && loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {data ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "pan-y" }}
          aria-busy={loading}
        >
          <DashboardGrid
            data={data}
            order={layout.order}
            hidden={layout.hidden}
            customising={customising}
            onReorder={reorder}
            onToggleHidden={toggleHidden}
          />
        </div>
      ) : null}
    </div>
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
