/**
 * Helpers for reading Postgres errors.
 *
 * Drizzle wraps driver errors, so `code` and `constraint_name` live on the
 * `cause` chain rather than on the error that reaches the route.
 */
type PgError = {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  cause?: unknown;
};

export function rootPgError(error: unknown) {
  let current: unknown = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    const candidate = current as PgError;
    if (candidate.code) return candidate;
    current = candidate.cause;
  }

  return null;
}

export function isUniqueViolation(error: unknown) {
  return rootPgError(error)?.code === "23505";
}

/** The index that rejected the row, e.g. users_email_idx. */
export function uniqueConstraint(error: unknown) {
  const clash = rootPgError(error);
  return clash?.constraint ?? clash?.constraint_name ?? null;
}
