import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import {
  dashboardWidgets,
  type DashboardWidget,
} from "@/components/dashboard/dashboard-widgets";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  data: DashboardData;
  order: string[];
  hidden: string[];
  customising: boolean;
  onReorder: (order: string[]) => void;
  onToggleHidden: (id: string) => void;
};

const spanClass: Record<DashboardWidget["span"], string> = {
  kpi: "sm:col-span-1 xl:col-span-3",
  half: "sm:col-span-2 xl:col-span-6",
};

export default function DashboardGrid({
  data,
  order,
  hidden,
  customising,
  onReorder,
  onToggleHidden,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = new Map(dashboardWidgets.map((widget) => [widget.id, widget]));
  const visible = order
    .filter((id) => !hidden.includes(id))
    .map((id) => byId.get(id))
    .filter((widget): widget is DashboardWidget => Boolean(widget));
  const visibleIds = visible.map((widget) => widget.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleIds.indexOf(String(active.id));
    const newIndex = visibleIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder only the visible slice, then slot it back into the full order so
    // hidden widgets keep their place.
    const nextVisible = arrayMove(visibleIds, oldIndex, newIndex);
    const iterator = nextVisible.values();
    const nextOrder = order.map((id) =>
      hidden.includes(id) ? id : (iterator.next().value as string),
    );
    onReorder(nextOrder);
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
            {visible.map((widget) => (
              <SortableWidget
                key={widget.id}
                id={widget.id}
                title={widget.title}
                span={widget.span}
                customising={customising}
                onHide={() => onToggleHidden(widget.id)}
              >
                {widget.render(data)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          Every widget is hidden. Show one below to see your shop again.
        </p>
      ) : null}

      {customising && hidden.length > 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hidden widgets
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((id) => {
              const widget = byId.get(id);
              if (!widget) return null;
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleHidden(id)}
                >
                  <PlusIcon />
                  {widget.title}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortableWidget({
  id,
  title,
  span,
  customising,
  onHide,
  children,
}: {
  id: string;
  title: string;
  span: DashboardWidget["span"];
  customising: boolean;
  onHide: () => void;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !customising });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "min-w-0",
        spanClass[span],
        isDragging && "relative z-20 opacity-80",
      )}
    >
      {customising ? (
        <div className="mb-1 flex items-center justify-between gap-2 rounded-md border border-dashed bg-background px-2 py-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${title}`}
            className="flex cursor-grab items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripIcon />
            Drag
          </button>
          <button
            type="button"
            onClick={onHide}
            aria-label={`Hide ${title}`}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <EyeOffIcon />
            Hide
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function GripIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m2 2 20 20" />
      <path d="M6.7 6.7C4.6 8.1 3 10.3 2 12c1.7 3 4.6 6 10 6 1.5 0 2.8-.3 4-.8" />
      <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5.4 0 8.3 3 10 7-1 1.8-2.4 3.8-4.3 5.2" />
      <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
