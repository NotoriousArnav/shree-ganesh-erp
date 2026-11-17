# AGENTS.md

npm workspaces monorepo: `packages/*`, `mushak/{frontend,backend}`, `lokkhi/{frontend,backend}`, `apps/tauri-app`. No root `tsconfig`, linter, or formatter.

## Commands (run from repo root unless noted)

- `npm ci` / `npm install` — install all workspaces.
- `npm run build:packages` — build `packages/db`, `packages/shared`, `packages/server` (`dist/`). **Required before dev/build/start** of any app and after editing `packages/*/src`.
- `npm run dev:mushak` — Mushak web+api (5173 + 8080). `npm run dev:lokkhi` — Lokkhi web+api (5175 + 8081).
- `npm test` — `node --import tsx --test "mushak/**/*.test.ts" "lokkhi/**/*.test.ts" "packages/shared/src/**/*.test.ts"` (27 tests total currently).
  - Single file: `node --import tsx --test mushak/frontend/src/lib/range.test.ts`
  - Per app: `npm run test:mushak` / `npm run test:lokkhi`.
- `npm run db:up` / `db:down` / `db:migrate` / `db:studio` — proxied to `mushak/backend` (Postgres 17 + RustFS compose in `mushak/backend/docker-compose.yml`).
- `npm run seed:admin`, `seed:demo`, `user:create -- ...`, `mail:test` — scripts run via `mushak/backend`.
- `npm run docs:openapi` / `docs:all` — OpenAPI export and Hugo docs (`scripts/build-docs.mjs`, needs Hugo theme clone/network in CI context).
- `npm run dev:tauri` / `npm run build:tauri` — Tauri shell in `apps/tauri-app` (desktop dev/bundle; Android via `npm run tauri -w apps/tauri-app -- android ...`). Requires Rust; app does not import the ERP packages.

## High-signal gotchas

- **Shared packages resolve to `dist/`, not `src/`**: `@ganesh/*` export `./dist/*.js`. Changes in `packages/*/src` do nothing until `npm run build:packages`.
- **Hoisted/undeclared dep**: `mushak/frontend` imports `@ganesh/shared` but does not declare it in its `package.json` (works via workspace hoisting). Do not switch Dockerfiles/install commands to scoped `--workspace` installs without adding that dependency.
- **Tests are glob-limited**: root `test` only collects `mushak/**/*.test.ts`, `lokkhi/**/*.test.ts`, `packages/shared/src/**/*.test.ts`. Tests under `packages/db` or `packages/server` (or elsewhere) will not run unless moved into those globs or the script is extended.
- **Backend shape**: each backend has `src/app.mts` exporting the Fastify instance (no `listen`) and `src/index.ts` as the only `listen()` entrypoint — keep both. Routes register absolute paths (e.g. `/api/merchant/...`); there is no route `prefix`, so new route files must include `/api`.
- **Shared auth/env side effects**: `src/env.ts` sets `process.env.APP_NAME` (module side effect) because `packages/server/src/auth.ts` is shared and reads `APP_NAME` for mail copy. `/docs` (swagger-ui) is skipped when `VERCEL` is set and `@fastify/swagger-ui` is loaded dynamically (ESM/`require(ESM)` issue with `content-disposition`). Mushak has `/mcp`; Lokkhi does not.
- **One DB, one schema, one migration history**: schema is `packages/db/src/schema.ts`; migrations live in `packages/db/drizzle/`. Never add a second schema or migrations dir. Generate migrations from `mushak/backend` (its `drizzle.config.ts` targets shared schema/env): `npm run db:generate -w mushak/backend`, then `npm run db:migrate`. DB client uses `max: 1` + `prepare: false` intentionally for pooled URLs (Neon/PgBouncer).
- **Auth/tenancy**: public sign-up is off (`ALLOW_SIGNUP` opt-in); accounts come from `seed:admin` / `user:create`. `merchant`/`staff` users need `users.merchant_id` or API calls fail. Merchant scope comes from session (`request.merchantAccess.merchantId`), never request body. Both apps share one Postgres and the same `BETTER_AUTH_SECRET` (same account works in both). `TRUSTED_ORIGINS` drives Better Auth origin checks (`*` disables checks, logs warning); CORS is permissive (`origin: true` + credentials) and is not access control. In non-production, trusted origins include loopback/LAN IPv4 for device testing. `advanced.ipAddress.ipAddressHeaders` includes `fly-client-ip` (needed for correct rate limiting behind proxies).
- **Frontend base paths/build variants**: `MUSHAK_BASE_PATH`/`LOKKHI_BASE_PATH` default `/`. Unified container builds use `/mushak/` and `/lokkhi/` (`docker/erp.Dockerfile`). Vercel combined build (`npm run build:dist`/`build:vercel`, root `vercel.json`, `api/*`) serves Mushak at `/` and Lokkhi at `/lokkhi/` (`LOKKHI_BASE_PATH=/lokkhi/`). Vite dev/preview proxy `/api` to local backends (8080/8081).

## Deploy / CI (current)

- **Unified container**: `docker/erp.Dockerfile` + `docker/Caddyfile` + `docker/entrypoint.sh` (build from repo root). Serves `/`, `/mushak/*`, `/lokkhi/*`, proxied app APIs/docs/health/mcp with app-prefix stripping to backend `/api/*` routes.
- **Split backends**: `docker/{mushak,lokkhi}.Dockerfile` (repo-root context), `fly.{mushak,lokkhi}.toml`. Frontends can deploy separately (e.g. Netlify per app; `BACKEND_URL` substitution in app `netlify.toml`).
- **Vercel (combined)**: root `vercel.json` routes `/api/*`+Mushak paths to `api/mushak`, `/lokkhi/api/*`+Lokkhi paths to `api/lokkhi`, with SPA rewrites/headers; build via `npm run build:vercel` (`build:dist`).
- **CI**: `.github/workflows/docs.yml` — `npm ci` + `npm test` on push to `master` and PRs; on non-PR runs also builds docs and deploys `dist/docs` to GitHub Pages. Edit docs in `<app>/docs/` (not `dist/`/`site/`).
- **Tauri CI**: `.github/workflows/tauri.yml` — builds macOS universal, Windows x86_64 (+ best-effort i686), Linux x86_64/arm64/armv7, and an Android universal APK (arm64-v8a + armeabi-v7a). A `required-builds` gate fails if any unskippable target fails, and `tauri-v*` tags (or a manual `release_tag` input) publish the bundles to the GitHub Releases tab. No Rust target exists for macOS ARM32 or Windows ARM32.
