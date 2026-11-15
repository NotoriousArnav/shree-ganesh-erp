/**
 * Per-app environment defaults.
 *
 * Each backend runs as its own Vercel project, so the dashboard values are
 * already app-specific. This keeps a sane name when APP_NAME is not set.
 */
process.env.APP_NAME ??= "Lokkhi";
