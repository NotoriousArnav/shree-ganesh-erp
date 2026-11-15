/**
 * Per-app environment defaults.
 *
 * Vercel Services share one set of project environment variables across every
 * service, so values that differ per app cannot come from the dashboard. Each
 * backend supplies its own name here; an explicit APP_NAME still wins.
 */
process.env.APP_NAME ??= "Mushak";
