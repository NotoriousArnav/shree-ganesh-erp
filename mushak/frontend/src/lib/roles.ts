/**
 * Where a signed-in role belongs.
 *
 * Used by login and by route guards: a role that cannot open a page is sent to
 * the area it can use instead of being shown an error.
 */
export function homePathForRole(role: string | null | undefined): string {
  if (role === "super_admin" || role === "dev") return "/admin";
  if (role === "merchant" || role === "staff") return "/app";

  return "/";
}
