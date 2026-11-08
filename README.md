# Shree Ganesh ERP

Mushak is the first application in the Shree Ganesh ERP suite.

## Stack

- **Frontend** — React 18, React Router v7, Vite 5, PWA, TypeScript, Tailwind CSS v4
- **Backend** — Fastify 5, TypeScript, OpenAPI/Swagger, MCP server
- **Database** — PostgreSQL 17 in Docker, Drizzle ORM + `postgres.js`
- **Auth** — Better Auth, email/password and phone/password, database sessions

## Getting started

```bash
npm install
cp mushak/backend/.env.example mushak/backend/.env   # first run only
npm run db:up                                        # start Postgres
npm run db:migrate                                   # apply migrations
npm run dev:mushak                                   # frontend + backend
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- API docs: http://localhost:8080/docs
- DB health: http://localhost:8080/health/db
- Storage health: http://localhost:8080/health/storage
- RustFS console: http://localhost:9001
- Sign in: http://localhost:5173/login

Create the first admin after the initial setup:

```bash
npm run seed:admin
```

It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `mushak/backend/.env`.

### Trying it on a phone

The Vite dev server listens on `0.0.0.0`, so a phone on the same Wi-Fi can open
`http://<laptop-lan-ip>:5173`. Auth trusts the laptop's LAN addresses
automatically in development, so signing in works without extra config.

If the frontend runs on another hostname or port, add it to `TRUSTED_ORIGINS`
(comma-separated) in `mushak/backend/.env` and restart the backend.

## Database

The database runs as the `mushak-db` container (`postgres:17-alpine`) with a
persistent named volume. Configuration is read from `mushak/backend/.env`:

```dotenv
DATABASE_URL=postgres://mushak:mushak_dev_password@localhost:5432/mushak
```

Scripts:

| Script | Description |
| --- | --- |
| `npm run db:up` | Start Postgres and RustFS containers |
| `npm run db:down` | Stop the containers (data is kept) |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:studio` | Open Drizzle Studio |

Schema changes:

```bash
npm run db:generate -w mushak/backend   # generate SQL from src/db/schema.ts
npm run db:migrate                      # apply it
```

The app uses `postgres.js` with `max: 1` and `prepare: false`, so the same code
works against a local container or a serverless/pooled provider such as Neon,
Supabase or Vercel Postgres — only `DATABASE_URL` changes.

## Authentication and roles

Better Auth handles sessions in the database and sets an http-only cookie.
Users sign in with **email or phone** plus a password. Public sign-up is
disabled; accounts are provisioned by the admin.

| Role | Scope | Access |
| --- | --- | --- |
| `super_admin` | Platform | Everything, including admin API and impersonation |
| `dev` | Platform | Read users/merchants, support actions, no role changes |
| `merchant` | One merchant | Own inventory and staff |
| `staff` | One merchant | Day-to-day operations, no user management |

Guards live in `mushak/backend/src/http/auth-guard.ts`. The merchant id always
comes from the session, never from the request body.

Create a user:

```bash
npm run user:create -- \
  --email owner@shop.in \
  --password 'a-strong-password' \
  --name 'Shop Owner' \
  --role merchant \
  --merchant ganesh-kirana \
  --phone +919876543210
```

`--merchant` accepts a merchant id or slug and is required for `merchant` and
`staff`. `--phone` is optional and enables phone sign-in.

Roles and merchant links can also be edited directly with Drizzle Studio.
`users.role` is constrained to the four role values; merchant-scoped accounts
must have `users.merchant_id` set before they can use the API.

### Adding a new merchant

A super admin registers a new shop through the admin API, then adds the owner:

```bash
# 1. Create the merchant shop.
curl -X POST http://localhost:8080/api/admin/merchants \
  -H 'content-type: application/json' -H 'cookie: <super_admin_session>' \
  -d '{"name":"Anime Point Siliguri","slug":"anime-point-siliguri","phone":"+919870000000}'

# 2. Create the shop owner (full permissions).
curl -X POST http://localhost:8080/api/admin/merchants/<merchantId>/users \
  -H 'content-type: application/json' -H 'cookie: <super_admin_session>' \
  -d '{"name":"Deepak Kothiyal","email":"deepak@anime-point.in","password":"a-strong-password","permissions":["stock","catalogue","categories"]}'
```

The admin UI exposes both calls on `/admin` via **Add merchant**.

Once the owner is in, they create staff from their own `/app/staff` screen, for
example for an anime/figurine shop:

- owner `Deepak Kothiyal` — `deepak@anime-point.in / deepak-pass-123` — full access
- staff `Sushrita Saha` — `sushrita@anime-point.in / sushrita-pass-123` — `["stock"]`

## Mail

Mail goes through `AbstractMailer` (`mushak/backend/src/mail/mailer.ts`).
A transport only implements `deliver()`; validation, recipients, the generated
message id and the MIME body are shared.

The current transport is `ConsoleMailer`:

- prints From/To/Subject/body to the terminal
- writes a `.eml` and a `.json` copy to `/tmp/mushak-mail` (mode `0600`)

```bash
npm run mail:test                       # send a sample message
npm run mail:test -- someone@shop.in    # send to a specific address
```

Configuration in `mushak/backend/.env`:

```dotenv
MAIL_DRIVER=console
MAIL_FROM=Mushak <no-reply@mushak.local>
MAIL_DIR=/tmp/mushak-mail
```

Password-reset and email-verification hooks already use the mailer, so
requesting a reset prints the link instead of sending it while `MAIL_DRIVER`
is `console`. The full browser flow is:

`/login` → **Forgot password?** → `/forgot-password` → emailed link →
`/reset-password` → sign in with the new password.

To add SMTP, extend `AbstractMailer` with a transport that implements
`deliver()` and select it in `getMailer()`.

## Object storage

Files (product images, invoices, attachments) go through `AbstractStorage` in
`mushak/backend/src/storage/storage.ts`. The S3 driver works with AWS S3,
RustFS, MinIO and any S3-compatible endpoint. `getStorage()` picks the driver
from `STORAGE_DRIVER`; the bundled `docker compose` runs RustFS locally, so
`npm run db:up` starts both Postgres and RustFS.

```dotenv
STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=mushakadmin
S3_SECRET_KEY=mushak_dev_storage_secret
S3_BUCKET=mushak
S3_FORCE_PATH_STYLE=true
# S3_PUBLIC_URL=https://cdn.example.com/mushak
```

The bucket is created on first use. Keys are tenant-scoped
(`<merchantId>/…`), and the controller refuses keys outside the caller's prefix.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/storage/status` | Driver, bucket, reachability and prefix |
| `POST` | `/api/storage/presign-upload` | Signed PUT URL (`catalogue` permission) |
| `GET` | `/api/storage/presign-download` | Signed GET URL for one key |
| `GET` | `/api/storage/objects` | List under the merchant prefix |
| `PUT` | `/api/storage/objects` | Direct upload as `application/octet-stream` (`catalogue`) |
| `DELETE` | `/api/storage/objects` | Delete one key (`catalogue`) |

Browser uploads use the presigned URL, so bytes go straight to RustFS and never
pass through the API server.

## Merchant app

Merchant and staff accounts land on `/app` after signing in:

| Screen | Path | What it does |
| --- | --- | --- |
| Dashboard | `/app` | Product and category counts, stock value, today's movements, low-stock list, recent activity |
| Inventory | `/app/inventory` | On-hand stock, values and reorder levels, stock adjustments, product detail |
| Catalogue | `/app/catalogue` | Product definitions: search, filters, add/edit/archive, prices, SKU and GST |
| Stock | `/app/stock` | Full stock-movement history |
| Categories | `/app/categories` | Create, rename and delete categories |
| Staff | `/app/staff` | Create counter logins, choose access, reset passwords, deactivate |

Inventory and Catalogue are two tables: `catalogue_items` holds the product
definition (name, SKU, prices, GST), and `inventory_items` holds the stock for
it (quantity, reorder level) with `stock_movements` as the audit trail. Adding a
product from either tab creates both rows in one transaction, so there is one
source of truth and no sync step. A catalogue item can exist with zero stock.

The category field on the product form accepts an existing name or a new one.
Typing a name that does not exist creates the category when the product is
saved, so a merchant never has to visit the Categories screen first. Names are
matched case-insensitively ("dairy" reuses "Dairy"). The same is available over
the API as `categoryName` on product create/update.

Barcode is optional — many items (loose grain, flowers, books) do not have one.
When SKU is left empty on create, a readable one is generated from the product
name and made unique within the shop (`BASMATI-RICE-5`, `BASMATI-RICE-5-2`).

### Appearance

The sun/moon/monitor switch appears in the shop sidebar, the mobile header and
the sign-in pages. It offers **Light**, **Dark** and **System**; System follows
the device setting and updates live when that changes. The choice is stored in
`localStorage` (`mushak-theme`) and applied by a tiny inline script before the
app loads, so there is no flash of the wrong theme.

Roles and staff access:

- **merchant** — owns the shop and always has every permission.
- **staff** — signs in with the same screens, but only does what the owner
  allows. Staff always see products and the dashboard. The owner can tick:
  - **stock** — record purchases, sales, damage and adjustments
  - **catalogue** — add, edit and archive products, prices, SKU and GST
  - **categories** — create, rename and delete categories

Nothing ticked means view-only. The Staff screen is merchant-only, and staff
cannot grant themselves more access. Permission changes take effect on the next
request, even if the staff member is already signed in. Deactivating an account
signs it out everywhere and blocks sign-in until it is reactivated.

Every merchant API call is scoped by `merchants.id` from the session; a
product id from another shop returns 404. Permissions are checked from the
database on each request, so `users.staff_permissions` is the source of truth.

### Demo shop

```bash
npm run seed:demo
```

Creates the `Ganesh Kirana` merchant, five categories, ten products with opening
stock, and two logins:

| Email | Phone | Password | Role |
| --- | --- | --- | --- |
| `merchant@mushak.local` | `+919876543210` | `merchant-pass-123` | merchant |
| `staff@mushak.local` | `+919876543211` | `staff-pass-123` | staff |

The shop data is fictional. The script is idempotent: existing merchant,
accounts, categories and SKUs are left alone.

### Merchant API

All routes require a merchant or staff session.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/merchant/profile` | Merchant row and signed-in user |
| `GET` | `/api/merchant/dashboard` | Counts, stock value, today, low stock, recent movements |
| `GET/POST` | `/api/merchant/categories` | List with product counts, create |
| `PATCH/DELETE` | `/api/merchant/categories/:id` | Rename, delete (products become uncategorised) |
| `GET/POST` | `/api/merchant/catalogue` | Product definitions, `q`/`categoryId`/`includeInactive` |
| `GET/PATCH/DELETE` | `/api/merchant/catalogue/:id` | Read, update, archive a definition |
| `GET/POST` | `/api/merchant/inventory` | Stock rows, filters: `q`, `categoryId`, `lowStock`, `includeInactive` |
| `GET/PATCH/DELETE` | `/api/merchant/inventory/:id` | Read, update, archive (id is the inventory row) |
| `POST` | `/api/merchant/inventory/:id/stock` | Stock movement |
| `GET` | `/api/merchant/inventory/:id/movements` | History for one product |
| `GET` | `/api/merchant/movements` | Recent movements, `?limit=` 1-200 (stock permission) |
| `GET/POST` | `/api/merchant/staff` | List staff, create a staff account (merchant only) |
| `PATCH` | `/api/merchant/staff/:id` | Name, phone, permissions or `active` (merchant only) |
| `POST` | `/api/merchant/staff/:id/password` | Reset a staff password (merchant only) |

Product, category and stock writes also require the matching staff permission.
Opening stock on a new product needs both `catalogue` and `stock`; creating a
new category inline needs `categories` (an existing one can always be reused).

Stock movements take a positive `quantity`; the type decides the sign:
`purchase`/`return_in`/`transfer_in` add, `sale`/`return_out`/`damage`/
`transfer_out` subtract, and `adjustment` needs `direction=in|out`. A movement
that would take stock below zero is rejected with a readable error, and the
stock update plus the movement row happen in one transaction.

## Documentation

The full documentation lives in [`mushak/docs/`](mushak/docs/README.md) and is
plain Markdown, so it can be published to GitHub Pages or rendered by any
Markdown site generator without modification.

- [Documentation index](mushak/docs/README.md) — start here
- [User guide](mushak/docs/user-guide/README.md) — concepts, screens, workflows, troubleshooting
- [Quick start](mushak/docs/user-guide/quick-start.md) — first-run walkthrough
- [Admin guide](mushak/docs/admin-guide/README.md) — platform administration
- [API reference](mushak/docs/api/README.md) — conventions, endpoints, and the generated OpenAPI document
- [Operations](mushak/docs/operations/setup.md) — setup, configuration, storage, mail, backups

The API reference is generated from the backend spec:

```bash
npm run docs:openapi     # writes mushak/docs/api/openapi.json
```

The backend serves the live OpenAPI document at `/openapi.json` and Swagger UI at
`/docs`; the checked-in copy under `mushak/docs/api/` is generated from source and
committed alongside the prose documentation.

## License

Released under the [MIT License](LICENSE). Because this repository is a
monorepo for the Shree Ganesh ERP suite, the root-level license applies to the
whole suite; the frontend and backend workspace packages carry the same
`MIT` identifier in their own manifests.

## Inventory schema (Phase 2)

- `merchants` — shop profile (name, GSTIN, currency, address)
- `categories` — merchant-scoped, optionally nested
- `catalogue_items` — product definition: unit, HSN, tax, prices and free-form
  `attributes` for vertical-specific fields
- `inventory_items` — stock for one catalogue item: quantity and reorder level,
  unique per catalogue item today so multi-location stock can grow into it
- `stock_movements` — signed audit trail of every stock change, linked to the
  inventory row

## Current phase

Phase 2 — Inventory schema, database connection, authentication, and the
merchant inventory app (products, stock, categories, dashboard, staff access).
