import type { EpochRange } from "./types";

/**
 * Range helpers.
 *
 * The API speaks Unix epoch seconds; the UI shows the canonical
 * `HH:MM:SS@DD/MM/YYYY#Weekday` form plus a fluent, human label.
 */

export const MAX_RANGE_SECONDS = 366 * 24 * 60 * 60;

const pad = (value: number) => String(value).padStart(2, "0");

function parts(epoch: number) {
  const date = new Date(epoch * 1000);
  return {
    date,
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}

/** 14:30:00@05/11/2026#Thursday */
export function formatBound(epoch: number): string {
  const value = parts(epoch);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
  }).format(value.date);

  return `${pad(value.hours)}:${pad(value.minutes)}:${pad(value.seconds)}@${pad(
    value.day,
  )}/${pad(value.month + 1)}/${value.year}#${weekday}`;
}

/** Thursday, 5 November 2026 at 2:30:00 pm */
export function formatFluent(epoch: number): string {
  const value = parts(epoch);
  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value.date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(value.date);

  return `${day} at ${time}`;
}

/** 5 Nov 2026, 2:30 pm — short label for headings and tables. */
export function formatShort(epoch: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epoch * 1000));
}

/** Short label for a whole range. */
export function formatRangeLabel(range: EpochRange): string {
  return `${formatShort(range.from)} → ${formatShort(range.to)}`;
}

export function rangeDuration(range: EpochRange): number {
  return Math.max(range.to - range.from, 0);
}

export function rangeLengthDays(range: EpochRange): number {
  return Math.max(Math.round(rangeDuration(range) / 86_400), 1);
}

export function shiftRange(range: EpochRange, direction: -1 | 1): EpochRange {
  const duration = rangeDuration(range);
  return {
    from: range.from + duration * direction,
    to: range.to + duration * direction,
  };
}

export function todayRange(): EpochRange {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(Date.now() / 1000),
  };
}

export function lastDaysRange(days: number): EpochRange {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Math.max(days, 1) - 1));

  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(Date.now() / 1000),
  };
}

export function thisMonthRange(): EpochRange {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(1);

  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(Date.now() / 1000),
  };
}

export function rangeQuery(range: EpochRange): string {
  return `from=${range.from}&to=${range.to}`;
}

/** Splits an epoch into the values native date/time inputs expect. */
export function inputParts(epoch: number) {
  const value = parts(epoch);
  return {
    date: `${value.year}-${pad(value.month + 1)}-${pad(value.day)}`,
    time: `${pad(value.hours)}:${pad(value.minutes)}:${pad(value.seconds)}`,
  };
}

/** Recombines local date + time inputs into epoch seconds. */
export function fromInputParts(dateValue: string, timeValue: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;

  const date = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    Number(timeMatch[3] ?? 0),
    0,
  );

  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

export function validateRange(range: EpochRange): string | null {
  if (range.to <= range.from) return "The end of the range must be after the start.";
  if (range.to - range.from > MAX_RANGE_SECONDS) {
    return "Choose a range of 366 days or less.";
  }
  return null;
}
