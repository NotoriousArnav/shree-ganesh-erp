# AGENTS.md

Four-workspace npm monorepo (`packages/*` + two app pairs). No root `tsconfig`, no
linter, no formatter. The only automated check is `npm test`.

## Commands

```bash
npm run build:packages   # ALWAYS before dev/build/start of any app
npm test                 # node:test via tsx; 27 tests in 4 files
npm run db:up            # Postgres 17 + RustFS (S3) via mushak/backend/docker-compose.yml
npm run db:migrate
npm run dev:mushak       # 5173 + 8080
npm run dev:lokkhi       # 5175 + 8081
```

Single test file: `node --import tsx --test mushak/frontend/src/lib/range.test.ts`

Tests are only collected from these globs: `mushak/**/*.test.ts`,
`lokkhi/**/*.test.ts`, `packages/shared/src/**/*.test.ts`. A test placed in
`packages/db` or `packages/server` silently never runs — add it under one of
those three paths or extend the root `test` script.

## Shared packages resolve to `dist/`, not `src`

`@ganesh/*` packages point `main`/`exports` at `./dist/*.js`, and there is no
watch build. Editing `packages/*/src` has **no effect** until
`npm run build:packages` runs again. This is the most common "my change does
nothing" trap.

`mushak/frontend` imports `@ganesh/shared` but does not declare it in its
`package.json` — it works only because npm hoists all workspaces. Do not switch
any Dockerfile or install command to scoped `--workspace` installs without
adding that dependency first.

## Backend shape

- `src/app.mts` exports the Fastify instance (default export, no socket);
  `src/index.ts` is the only `listen()`. Keep both.
- Routes register absolute paths like `/api/merchant/...`; there is no
  `prefix` option, so a new route file must include `/api` itself.
- `src/env.ts` sets `process.env.APP_NAME` as a module side effect — required
  because `packages/server/src/auth.ts` is shared by both apps and reads
  `APP_NAME` for mail copy.
- `/docs` (swagger-ui) is skipped when `process.env.VERCEL` is set, and
  `@fastify/swagger-ui` is imported dynamically, because its `content-disposition`
  dependency is ESM-only under runtimes that disable `require(ESM)`.
- `/mcp` exists on Mushak only. `[boot] ...` console lines and the 10s boot
  watchdog are leftover Vercel diagnostics, safe to remove.
- Both apps share one Postgres and the same `BETTER_AUTH_SECRET`; the account
  created in one works in the other.

## Database

- One schema for both apps: `packages/db/src/schema.ts`. One migration history:
  `packages/db/drizzle/`. Never create a second schema or migrations dir.
- Generate from the backend, not the package:
  `npm run db:generate -w mushak/backend` (its `drizzle.config.ts` points at the
  shared schema and the local env file). Then `npm run db:migrate`.
- The client uses `max: 1` + `prepare: false` on purpose, so pooled URLs
  (Neon/PgBouncer) work. Don't add a `max` bump.

## Auth gotchas

- Public sign-up is off (`ALLOW_SIGNUP` opt-in). Accounts come from
  `npm run seed:admin` / `npm run user:create`. `merchant` and `staff` accounts
  need `users.merchant_id` set or every API call fails.
- Merchant scope always comes from the session, never the request body.
- `TRUSTED_ORIGINS` feeds Better Auth's origin checks; `*` turns those checks
  off and logs a warning at boot. CORS is separate and permissive everywhere
  (`origin: true` + credentials, reflecting the caller's origin) — it is not
  access control, every route still authenticates.
- When `NODE_ENV !== production`, `buildTrustedOrigins()` adds loopback and all
  LAN IPv4 addresses of the dev machine, so a phone on the same Wi-Fi can sign
  in; production uses only the configured origins.
- `advanced.ipAddress.ipAddressHeaders` includes `fly-client-ip` — without it,
  rate limiting collapses into one global bucket behind any proxy.

## Deploy state

- **Unified container:** `docker/erp.Dockerfile` builds Caddy + both backends +
  both SPA builds from the **repo root**. Public paths: `/mushak/*`, `/lokkhi/*`,
  `/mushak/api/*`, `/lokkhi/api/*` (Caddy strips the app prefix so backends keep
  `/api/*` routes), plus `/health`, `/mushak/docs|openapi.json|mcp*`,
  `/lokkhi/docs|openapi.json|health*`. Frontends are built with
  `MUSHAK_BASE_PATH=/mushak/` and `LOKKHI_BASE_PATH=/lokkhi/`.
- **Split backends:** `docker/{mushak,lokkhi}.Dockerfile` from repo root,
  `.dockerignore` keeps `.env*` out. `fly.{mushak,lokkhi}.toml` use region `sin`,
  port 8080, auto-stop. Deploy: `fly deploy --config fly.mushak.toml`.
- **Frontends:** one Netlify site each. `netlify.toml` build `sed`s
  `BACKEND_PLACEHOLDER` with `BACKEND_URL`; missing `BACKEND_URL` must fail.
  `MUSHAK_BASE_PATH`/`LOKKHI_BASE_PATH` default `/` for standalone/frontend-only
  deploys.
- **Abandoned:** `mushak/backend/vercel.json`, `lokkhi/backend/vercel.json`, the
  `build:vercel` esbuild scripts, and Vercel services docs. Vercel never served
  a successful invocation; Docker is the working path.

## Docs

`npm run docs:all` builds Hugo sites from `mushak/docs` and `lokkhi/docs` into
`dist/docs/`, cloning the `hugo-book` theme. CI (`.github/workflows`) runs
`npm test` on every push to `master`, then builds docs and publishes to GitHub
Pages. Docs edits belong in `<app>/docs/`, never in `dist/` or `site/`.
