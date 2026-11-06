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
- Sign in: http://localhost:5173/login

Create the first admin after the initial setup:

```bash
npm run seed:admin
```

It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `mushak/backend/.env`.

## Database

The database runs as the `mushak-db` container (`postgres:17-alpine`) with a
persistent named volume. Configuration is read from `mushak/backend/.env`:

```dotenv
DATABASE_URL=postgres://mushak:mushak_dev_password@localhost:5432/mushak
```

Scripts:

| Script | Description |
| --- | --- |
| `npm run db:up` | Start the Postgres container |
| `npm run db:down` | Stop the container (data is kept) |
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

## Inventory schema (Phase 2)

- `merchants` — shop profile (name, GSTIN, currency, address)
- `categories` — merchant-scoped, optionally nested
- `products` — generic item with unit, HSN, tax, prices, cached stock and
  free-form `attributes` for vertical-specific fields
- `stock_movements` — signed audit trail of every stock change

## Current phase

Phase 2 — Inventory schema, database connection, and authentication.
