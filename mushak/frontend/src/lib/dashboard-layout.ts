export type DashboardLayout = {
  order: string[];
  hidden: string[];
};

const STORAGE_PREFIX = "mushak.dashboard.layout.v1";

function key(merchantId: string) {
  return `${STORAGE_PREFIX}:${merchantId}`;
}

/**
 * Reads the saved widget order for one shop.
 *
 * Unknown ids are dropped and new widgets are appended, so a layout survives
 * adding or renaming widgets between releases.
 */
export function loadLayout(
  merchantId: string | null | undefined,
  knownIds: readonly string[],
): DashboardLayout {
  const fallback: DashboardLayout = { order: [...knownIds], hidden: [] };
  if (!merchantId || typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key(merchantId));
    if (!raw) return fallback;

    const saved = JSON.parse(raw) as Partial<DashboardLayout>;
    const known = new Set(knownIds);

    const order = (Array.isArray(saved.order) ? saved.order : []).filter(
      (id): id is string => typeof id === "string" && known.has(id),
    );
    for (const id of knownIds) {
      if (!order.includes(id)) order.push(id);
    }

    const hidden = (Array.isArray(saved.hidden) ? saved.hidden : []).filter(
      (id): id is string => typeof id === "string" && known.has(id),
    );

    return { order, hidden };
  } catch {
    return fallback;
  }
}

export function saveLayout(
  merchantId: string | null | undefined,
  layout: DashboardLayout,
) {
  if (!merchantId || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key(merchantId), JSON.stringify(layout));
  } catch {
    // A full or blocked localStorage must not break the dashboard.
  }
}

export function clearLayout(merchantId: string | null | undefined) {
  if (!merchantId || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key(merchantId));
  } catch {
    // Ignore storage failures.
  }
}
