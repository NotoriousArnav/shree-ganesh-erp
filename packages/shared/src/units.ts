/**
 * Units that are counted, not weighed. Quantities for these must be whole
 * numbers; a half piece or 2.5 boxes is a data-entry mistake.
 */
export const discreteUnits = [
  "pcs",
  "piece",
  "unit",
  "box",
  "packet",
  "dozen",
  "bottle",
  "strip",
  "set",
] as const;

/**
 * Units that are measured. These keep fractional quantities: 1.5 kg, 250.5 g,
 * 0.75 litre. The database column is numeric(14,3) for exactly this reason.
 */
export const fractionalUnits = [
  "kg",
  "g",
  "litre",
  "liter",
  "l",
  "ml",
  "m",
  "meter",
  "metre",
  "ft",
] as const;

const discrete = new Set<string>(discreteUnits);
const fractional = new Set<string>(fractionalUnits);

/**
 * True when a unit may have a fractional quantity.
 *
 * Unknown or custom units default to whole numbers, because a shop that types a
 * custom unit is almost always counting something.
 */
export function unitAllowsFraction(unit: string): boolean {
  const value = unit.trim().toLowerCase();
  if (fractional.has(value)) return true;
  if (discrete.has(value)) return false;
  return false;
}

/** HTML input step for a unit: 1 for counted items, 0.001 for measured ones. */
export function unitStep(unit: string): number {
  return unitAllowsFraction(unit) ? 0.001 : 1;
}

/**
 * Validates quantity against its unit. Returns an error message, or null when
 * the value is acceptable.
 */
export function quantityError(unit: string, quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be more than zero";
  }

  if (!unitAllowsFraction(unit) && !Number.isInteger(quantity)) {
    return `Use a whole number for ${unit}`;
  }

  return null;
}
