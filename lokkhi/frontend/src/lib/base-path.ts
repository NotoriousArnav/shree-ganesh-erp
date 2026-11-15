/**
 * The public path the app is mounted under.
 *
 * Vite sets `BASE_URL` from its `base` option: `/lokkhi/` when the app is
 * mounted at that prefix on Vercel, and `/` for local development and the
 * Netlify deployment. Strip the trailing slash so it can be used as a router
 * basename and as a prefix for absolute URLs.
 */
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Prefix an app-absolute path (`/invoices`) with the public base path. */
export function withBasePath(path: string) {
  return `${basePath}${path}`;
}
