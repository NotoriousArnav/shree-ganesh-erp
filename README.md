# Shree Ganesh ERP

Mushak is the first application in the Shree Ganesh ERP suite.

## Stack

- **Frontend** — React 18, React Router v7, Vite 5, PWA, TypeScript, Tailwind CSS v4
- **Backend** — Fastify 5, TypeScript, OpenAPI/Swagger, MCP server
- **Database** — PostgreSQL 17 in Docker, Drizzle ORM + `postgres.js`

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

## Inventory schema (Phase 2)

- `merchants` — shop profile (name, GSTIN, currency, address)
- `categories` — merchant-scoped, optionally nested
- `products` — generic item with unit, HSN, tax, prices, cached stock and
  free-form `attributes` for vertical-specific fields
- `stock_movements` — signed audit trail of every stock change

## Current phase

Phase 2 — Inventory schema and database connection.
