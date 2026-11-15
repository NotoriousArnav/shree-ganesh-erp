/**
 * The public path the app is mounted under.
 *
 * Vite sets `BASE_URL` from its `base` option: `/mushak/` when the app runs
 * behind the unified container's router, and `/` for local development and
 * Netlify. Strip the trailing slash so it can be used as a router basename and
 * as a prefix for absolute URLs.
 */
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Prefix an app-absolute path (`/app`) with the public base path. */
export function withBasePath(path: string) {
  return `${basePath}${path}`;
}
