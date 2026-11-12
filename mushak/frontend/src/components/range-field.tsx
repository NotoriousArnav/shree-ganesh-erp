import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatBound,
  formatFluent,
  fromInputParts,
  inputParts,
  lastDaysRange,
  rangeLengthDays,
  shiftRange,
  thisMonthRange,
  todayRange,
  validateRange,
} from "@/lib/range";
import type { EpochRange } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  value: EpochRange;
  onChange: (range: EpochRange) => void;
  className?: string;
};

/**
 * Shared From/To range control.
 *
 * Edits are local until the range is valid, so an in-progress date or time
 * change never requests nonsense from the API.
 */
export default function RangeField({ value, onChange, className }: Props) {
  const [draft, setDraft] = useState<EpochRange>(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value.from, value.to]);

  function commit(next: EpochRange) {
    setDraft(next);
    const message = validateRange(next);
    setError(message);
    if (!message) onChange(next);
  }

  function preset(range: EpochRange) {
    commit(range);
  }

  return (
    <section className={cn("space-y-3", className)} aria-label="Date range">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <PresetButton onClick={() => preset(todayRange())}>Today</PresetButton>
          <PresetButton onClick={() => preset(lastDaysRange(7))}>7 days</PresetButton>
          <PresetButton onClick={() => preset(lastDaysRange(30))}>30 days</PresetButton>
          <PresetButton onClick={() => preset(thisMonthRange())}>This month</PresetButton>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {rangeLengthDays(draft)} {rangeLengthDays(draft) === 1 ? "day" : "days"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous period"
            onClick={() => commit(shiftRange(draft, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Next period"
            onClick={() => commit(shiftRange(draft, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <BoundEditor
          label="From"
          epoch={draft.from}
          onChange={(from) => commit({ ...draft, from })}
        />
        <BoundEditor
          label="To"
          epoch={draft.to}
          onChange={(to) => commit({ ...draft, to })}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function BoundEditor({
  label,
  epoch,
  onChange,
}: {
  label: string;
  epoch: number;
  onChange: (epoch: number) => void;
}) {
  const { date, time } = inputParts(epoch);

  function setDate(value: string) {
    const next = fromInputParts(value, time);
    if (next !== null) onChange(next);
  }

  function setTime(value: string) {
    const next = fromInputParts(date, value);
    if (next !== null) onChange(next);
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatBound(epoch)}
        </span>
      </div>
      <p className="mt-1 text-sm">{formatFluent(epoch)}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Input
          type="date"
          value={date}
          aria-label={`${label} date`}
          onChange={(event) => setDate(event.target.value)}
        />
        <Input
          type="time"
          step="1"
          value={time}
          aria-label={`${label} time`}
          onChange={(event) => setTime(event.target.value)}
        />
      </div>
    </div>
  );
}

function PresetButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function ChevronLeft() {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
