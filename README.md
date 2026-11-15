# Shree Ganesh ERP

A suite of modular web applications designed for small merchants, kirana stores, bookshops, and retail businesses. Each application can run independently or together as a unified suite, sharing the same shops, users, credentials, and PostgreSQL database.

---

## Suite Applications & Service Matrix

| App / Service | Description | Local Port | Backend API | Swagger Docs | Default Route |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mushak** | Catalogue, stock tracking, categories, staff, dashboard, reports, MCP | `5173` | `http://localhost:8080` | `http://localhost:8080/docs` | `http://localhost:5173/app` |
| **Lokkhi** | Sales and purchase invoices, sequences, printing, PDF export | `5175` | `http://localhost:8081` | `http://localhost:8081/docs` | `http://localhost:5175/invoices` |
| **PostgreSQL 17** | Shared transactional database | `5432` | — | — | `postgres://mushak:...@localhost:5432/mushak` |
| **RustFS (S3)** | S3-compatible storage for product images & invoice assets | `9000` | S3 API: `:9000` | Web Console: `:9001` | `http://localhost:9001` |

Shared libraries live under `packages/`:
- **`@ganesh/db`**: Single source of truth for Drizzle ORM schema, migrations, and database client.
- **`@ganesh/shared`**: Tax-exclusive pricing, invoice line totals, unit fraction validation, CSV exports.
- **`@ganesh/server`**: Better Auth configuration, session verification, permission guards, email dispatch.

Invoices in Lokkhi are self-contained snapshots: Mushak acts as an optional suggestion source, not a validation gate. You can issue and print invoices even for custom items that do not exist in the catalogue.

---

## Technology Stack

- **Frontend**: React 18, React Router v7, Vite 5, Tailwind CSS v4, PWA (offline capability & manifest).
- **Backend**: Fastify 5, TypeScript, OpenAPI/Swagger UI, Model Context Protocol (MCP server on Mushak).
- **Database**: PostgreSQL 17 (Docker), Drizzle ORM, `postgres.js` with serverless connection pooling (`max: 1`, `prepare: false`).
- **Authentication**: Better Auth with HTTP-only cookies, password hashing, database sessions, and role/permission verification.
- **Object Storage**: RustFS (S3-compatible, bundled in Docker Compose) or AWS S3 / MinIO.
- **Documentation**: Hugo Book sites, OpenAPI 3.1 specifications.

---

## Prerequisites Checklist

Ensure the following tools are installed on your machine before starting:

1. **Node.js**: `v20.x` or `v24.x LTS` (`node -v`)
2. **npm**: `v10.x` or later (`npm -v`)
3. **Docker & Docker Compose**: Running daemon required for local Postgres and RustFS storage (`docker --version` and `docker compose version`).
4. **Git**: For version control (`git --version`).

---

## Quickstart: Zero to Running in 5 Minutes

Follow these step-by-step instructions in order from the repository root:

### 1. Clone the repository
```bash
git clone https://github.com/your-username/GaneshaMerchantAssistiveSoftware.git
cd GaneshaMerchantAssistiveSoftware
```

### 2. Install dependencies
```bash
npm install
```
> [!NOTE]
> All packages are managed as an npm workspace. A single `npm install` at the root installs dependencies across the root, shared packages, and both apps.

### 3. Configure environment files
Both backends require their own `.env` configuration file:
```bash
# 1. Configure Mushak backend
cp mushak/backend/.env.example mushak/backend/.env

# 2. Configure Lokkhi backend
cp lokkhi/backend/.env.example lokkhi/backend/.env
```

> [!IMPORTANT]
> **Auth Secret Pairing**: Open both `mushak/backend/.env` and `lokkhi/backend/.env` and ensure `BETTER_AUTH_SECRET` has the **exact same value** in both files. This allows the same user session and login credentials to work seamlessly across both applications.
>
> You can generate a random 32-byte secret with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
> ```

### 4. Build shared packages
```bash
npm run build:packages
```
> [!WARNING]
> Shared packages (`@ganesh/db`, `@ganesh/shared`, `@ganesh/server`) resolve to their compiled `dist/` folders. You **must** run `npm run build:packages` before starting any app and whenever you edit code in `packages/*/src`.

### 5. Start the database and storage services
Launch PostgreSQL 17 and RustFS (S3) via Docker:
```bash
npm run db:up
```
Verify the containers are healthy with `docker ps`. You should see `mushak-db` and `mushak-rustfs` running.

### 6. Apply database migrations
Push the initial schema to the database:
```bash
npm run db:migrate
```

### 7. Seed demo data and platform admin
Populate the database with ready-to-test data:
```bash
# Creates the "Ganesh Kirana" demo merchant, categories, products, opening stock, and logins:
npm run seed:demo

# Creates the platform Super Admin account (reads ADMIN_EMAIL & ADMIN_PASSWORD from mushak/backend/.env):
npm run seed:admin
```

### 8. Start the development servers
Open two terminal windows to run both applications simultaneously, or start whichever app you need:

#### Option A: Start Mushak (Catalogue & Inventory)
```bash
npm run dev:mushak
```
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **API Documentation**: [http://localhost:8080/docs](http://localhost:8080/docs)

#### Option B: Start Lokkhi (Invoices & Billing)
```bash
npm run dev:lokkhi
```
- **Web App**: [http://localhost:5175](http://localhost:5175)
- **Backend API**: [http://localhost:8081](http://localhost:8081)
- **API Documentation**: [http://localhost:8081/docs](http://localhost:8081/docs)

---

## Default Login Credentials

After running `npm run seed:demo` and `npm run seed:admin`, the following accounts are ready to use in either app:

| Role | Email / Phone | Password | Capabilities & Scope |
| :--- | :--- | :--- | :--- |
| **Merchant (Owner)** | `merchant@mushak.local`<br>`+919876543210` | `merchant-pass-123` | Full access to Ganesh Kirana (products, categories, stock, staff, invoices, reports). |
| **Staff Member** | `staff@mushak.local`<br>`+919876543211` | `staff-pass-123` | Counter operations; permissions governed by the shop owner (defaults to stock/sales). |
| **Super Admin** | `admin@mushak.local` | `change-me-mushak-admin` | Platform owner; manage merchants and users at `http://localhost:5173/admin`. |

---

## Verifying Setup & Health Checks

Verify your backend services and databases with these endpoints:

```bash
# Mushak health checks
curl http://localhost:8080/health          # Expected: {"status":"ok"}
curl http://localhost:8080/health/db       # Expected: {"status":"ok","database":"connected"}
curl http://localhost:8080/health/storage  # Expected: {"status":"ok","storage":"ready"}

# Lokkhi health checks
curl http://localhost:8081/health          # Expected: {"status":"ok","app":"lokkhi"}
curl http://localhost:8081/health/db       # Expected: {"status":"ok","database":"connected"}

# RustFS (S3) Console
# Visit http://localhost:9001 in your browser
# Username: mushakadmin
# Password: mushak_dev_storage_secret
```

Run the automated test suite to ensure calculations, formatting, and unit logic are working:
```bash
npm test
```
All 27 test cases should pass.

---

## Mobile & Local Network (Wi-Fi) Testing

You can test either app on a physical phone or tablet connected to the same Wi-Fi network:

1. Find your machine's local IP address (e.g., `192.168.1.50`).
2. The Vite dev servers and Fastify backends listen on `0.0.0.0` by default.
3. Open `http://<your-lan-ip>:5173` (Mushak) or `http://<your-lan-ip>:5175` (Lokkhi) on your phone.
4. In development (`NODE_ENV !== "production"`), the backend automatically trusts loopback and local network IPv4 origins, allowing authentication from your mobile device without manual CORS configuration.

---

## Monorepo Architecture & Conventions

### Shared Packages Resolve to `dist/`, not `src/`
Shared packages (`@ganesh/db`, `@ganesh/shared`, `@ganesh/server`) export precompiled JavaScript from `./dist/`. **Editing `packages/*/src` has no effect until you run `npm run build:packages`.** If you make changes to shared code and see no difference in runtime behavior, re-run:
```bash
npm run build:packages
```

### Backend Structure
- **Two files per service**: `src/app.mts` configures and exports the Fastify instance (without listening); `src/index.ts` is the sole entry point that invokes `.listen()`.
- **Absolute Routes**: All backend route handlers declare full paths (e.g., `/api/merchant/...` or `/api/admin/...`). There is no global prefix plugin.
- **Tenant Isolation**: Every merchant-facing endpoint pulls the `merchantId` from the active session (`request.merchantAccess.merchantId`). Never pass `merchantId` in request bodies or query parameters.

### Database & Migrations
- The entire monorepo shares **one database schema** (`packages/db/src/schema.ts`) and **one migration folder** (`packages/db/drizzle/`).
- Database migrations must be generated from the `mushak/backend` workspace:
  ```bash
  npm run db:generate -w mushak/backend
  npm run db:migrate
  ```
- To inspect or edit records visually, launch Drizzle Studio:
  ```bash
  npm run db:studio
  ```

---

## Detailed Application Guides

### 1. Mushak (Catalogue, Stock & Staff)

Accessible at `http://localhost:5173/app` after signing in.

- **Catalogue vs. Inventory**:
  - `catalogue_items` represents *what a product is* (name, barcode, SKU, tax rate, purchase/selling price, unit, attributes).
  - `inventory_items` tracks *how much the store owns* (stock quantity, reorder level).
  - `stock_movements` provides a signed audit trail for every addition, deduction, purchase, damage, and adjustment.
- **Inline Categories**: Typing a category that does not exist directly in the product creation modal automatically creates it on save.
- **Staff Permissions**:
  - The `merchant` owner has full access.
  - The owner can grant specific permissions to `staff` accounts: `stock` (record movements), `catalogue` (add/edit products and pricing), and `categories` (category management). Staff accounts without granted permissions operate in view-only mode.
- **Object Storage**:
  - Upload product photos and shop logos directly from the UI.
  - Files are stored in RustFS (or AWS S3) via presigned URLs and scoped to `<merchantId>/...`.

### 2. Lokkhi (Invoicing & Billing)

Accessible at `http://localhost:5175/invoices` after signing in.

- **Independent Snapshots**: Lokkhi creates self-contained invoice line items (`item_name`, `unit_price`, `quantity`, `tax_rate`, `discount`). If a catalogue product is altered or deleted in Mushak later, historic invoices remain perfectly intact and unaltered.
- **Mushak Linkage**: Typing product names in an invoice line fetches instant suggestions from Mushak's catalogue. Linked items automatically sync stock movements upon invoice issuance on a best-effort basis.
- **Sequential Numbering**: Thread-safe, per-merchant financial year invoice numbering (`SALE/2026-27/0001`).
- **Printing & PDF**: Clean, print-ready invoices supporting thermal receipt printers and standard A4 printing.

---

## User & Merchant Administration

### Provisioning Accounts via CLI
Because public sign-up is disabled (`ALLOW_SIGNUP=false`), accounts are created via CLI or the Admin UI:

```bash
# Create a merchant or staff user:
npm run user:create -- \
  --email owner@myshop.in \
  --password 'SuperSecret123' \
  --name 'Shop Owner' \
  --role merchant \
  --merchant ganesh-kirana \
  --phone +919876543210

# Reset a user's password without triggering email delivery:
npm run user:reset-password -w mushak/backend -- \
  --email owner@myshop.in \
  --password 'NewStrongPassword123'
```

### Adding a New Merchant via Admin UI
1. Sign in to [http://localhost:5173/login](http://localhost:5173/login) with the Super Admin credentials (`admin@mushak.local` / `change-me-mushak-admin`).
2. Navigate to `/admin`.
3. Click **Add Merchant**, enter shop details (name, slug, currency, phone), and provision the shop owner account.

---

## Common Gotchas & Troubleshooting

### 1. `Cannot connect to Postgres (port 5432)`
- **Symptom**: `ECONNREFUSED 127.0.0.1:5432` or migration fails.
- **Fix**: Check if Docker is running (`docker info`). Ensure you started the database with `npm run db:up`. If you have a local PostgreSQL instance running on your host machine, either stop it (`sudo systemctl stop postgresql`) or change `POSTGRES_PORT` in `mushak/backend/.env` and update `DATABASE_URL`.

### 2. `Changes in shared packages have no effect`
- **Symptom**: Code edited in `packages/shared/src` or `packages/db/src` is ignored.
- **Fix**: Run `npm run build:packages`. Shared packages point to `dist/`, not `src/`.

### 3. `Authentication fails or session drops when switching apps`
- **Symptom**: Signing into Mushak works, but Lokkhi rejects the session or prompts for sign-in again.
- **Fix**: Check `mushak/backend/.env` and `lokkhi/backend/.env`. The `BETTER_AUTH_SECRET` value **must match exactly** in both files.

### 4. `API returns 401 Unauthorized or 403 Forbidden`
- **Symptom**: User can sign in, but API requests fail with 403.
- **Fix**: Users with `merchant` or `staff` roles require `users.merchant_id` to be populated in the database. Use `npm run seed:demo` or use `--merchant <id-or-slug>` when creating users with `npm run user:create`.

### 5. `RustFS (S3) upload errors`
- **Symptom**: Image uploads fail or return 503.
- **Fix**: Verify storage container health at `http://localhost:8080/health/storage`. Ensure `mushak-rustfs` container is running (`npm run db:up`).

---

## Monorepo Scripts Reference

| Command | Purpose |
| :--- | :--- |
| `npm run build:packages` | Compiles TypeScript in `packages/db`, `packages/shared`, and `packages/server` into `dist/`. |
| `npm run build` | Builds shared packages, Mushak frontend/backend, and Lokkhi frontend/backend. |
| `npm run dev:mushak` | Runs Mushak frontend (5173) and backend (8080) concurrently with live reload. |
| `npm run dev:lokkhi` | Runs Lokkhi frontend (5175) and backend (8081) concurrently with live reload. |
| `npm test` | Executes the 27 unit tests across all workspaces using Node's native test runner. |
| `npm run test:watch` | Runs unit tests in watch mode, re-running on file changes. |
| `npm run db:up` | Starts Postgres 17 and RustFS (S3) Docker containers in the background. |
| `npm run db:down` | Stops the Docker containers (data is retained in Docker volumes). |
| `npm run db:migrate` | Applies pending Drizzle migrations to PostgreSQL. |
| `npm run db:studio` | Launches Drizzle Studio GUI for visual database inspection. |
| `npm run seed:demo` | Seeds demo merchant "Ganesh Kirana" with products, categories, stock, and logins. |
| `npm run seed:admin` | Seeds or verifies the Super Admin account configured in `.env`. |
| `npm run user:create -- ...` | Creates a new user with specific role and merchant binding. |
| `npm run mail:test` | Sends a test email to verify Nodemailer SMTP / console mailer configuration. |
| `npm run docs:openapi` | Exports fresh OpenAPI specification JSON to documentation directory. |
| `npm run docs:all` | Compiles Hugo documentation books for all apps into `dist/docs/`. |

---

## Production Deployment

### Option A: Unified container (entire ERP on one origin)

`docker/erp.Dockerfile` builds one image that runs Caddy, both Fastify backends,
and both SPA builds with path-prefix separation:

| URL prefix | Serves |
| --- | --- |
| `/` | redirects to `/mushak/` |
| `/mushak/`, `/lokkhi/` | Mushak and Lokkhi frontends |
| `/mushak/api/*`, `/lokkhi/api/*` | matching backends (prefix stripped to `/api/*`) |
| `/mushak/docs`, `/mushak/openapi.json`, `/mushak/mcp*`, `/lokkhi/docs` | docs and tooling |
| `/health` | container-level health |

Build and run from the **repository root** (context must include `packages/`):

```bash
docker build -f docker/erp.Dockerfile -t ganesh-erp .

docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgres://... \
  -e BETTER_AUTH_SECRET=... \
  -e BETTER_AUTH_URL=https://erp.example.com \
  -e FRONTEND_URL=https://erp.example.com \
  -e TRUSTED_ORIGINS=https://erp.example.com \
  -e MAIL_DRIVER=smtp -e SMTP_HOST=... \
  -e STORAGE_DRIVER=s3 -e S3_BUCKET=... \
  ganesh-erp
```

`BETTER_AUTH_URL` and `FRONTEND_URL` are the public origin (no path suffix). Both
apps share one database and `BETTER_AUTH_SECRET`, so the same account works in
both. Better Auth password-reset links are routed to the correct app by Caddy
based on the `callbackURL` the frontends send.

### Option B: Split deploy (separate backends + frontends)

**Backends (Docker / Fly.io).** Standalone images, built from the repo root:

- Mushak API: `docker/mushak.Dockerfile` / `fly.mushak.toml`
- Lokkhi API: `docker/lokkhi.Dockerfile` / `fly.lokkhi.toml`

```bash
fly secrets set --config fly.mushak.toml DATABASE_URL=... BETTER_AUTH_SECRET=...
fly secrets set --config fly.lokkhi.toml DATABASE_URL=... BETTER_AUTH_SECRET=...

fly deploy --config fly.mushak.toml
fly deploy --config fly.lokkhi.toml
```

**Frontends (Netlify).** One site per app:

1. **Base directory**: leave empty (repo root). **Package directory**: `mushak` or `lokkhi`.
2. **Environment**: `BACKEND_URL` = the deployed backend origin (no trailing slash).
3. **Build**: `mushak/netlify.toml` / `lokkhi/netlify.toml` build and substitute
   `BACKEND_URL` into `/api/*` proxy redirects, keeping the browser same-origin
   with the Netlify site. For Lokkhi, set `BACKEND_URL` to the Lokkhi backend
   (or `<origin>/lokkhi` if it is mounted under a prefix). Set `FRONTEND_URL`,
   `BETTER_AUTH_URL`, and `TRUSTED_ORIGINS` on each backend to the real frontend
   domain.

---

## License

Released under the [MIT License](LICENSE).
Part of the Shree Ganesh ERP Suite.
