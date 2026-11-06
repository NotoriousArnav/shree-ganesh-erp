const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** ₹1,234.50 — falls back to the merchant currency code. */
export function money(value: number, currency = "INR") {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(Number.isFinite(value) ? value : 0);
}

/** Drops trailing zeros: 12, 12.5, 0.75. */
export function qty(value: number) {
  return Number(value.toFixed(3)).toLocaleString("en-IN");
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const movementLabels: Record<string, string> = {
  purchase: "Purchase",
  sale: "Sale",
  return_in: "Return in",
  return_out: "Return out",
  adjustment: "Adjustment",
  damage: "Damage",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
};
