# Setup and deployment

Lokkhi is a separate app in the monorepo. It has its own backend on **8081** and
frontend on **5175**, and it shares the Mushak Postgres database so shops, users
and stock stay in one place.

## Requirements

- Node.js 20 or newer
- The same Postgres instance Mushak uses
- A Better Auth secret shared with Mushak (so sessions are signed identically)

## First run

```bash
npm install
npm run build:packages
cp lokkhi/backend/.env.example lokkhi/backend/.env
# set DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, FRONTEND_URL
npm run db:migrate                # applies shared migrations, including invoices
npm run dev:lokkhi
```

- Frontend: http://localhost:5175
- Backend: http://localhost:8081
- API docs: http://localhost:8081/docs
- DB health: http://localhost:8081/health/db

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port, default `8081` |
| `APP_NAME` | Product name in mail and logs, set to `Lokkhi` |
| `DATABASE_URL` | Shared Postgres connection |
| `BETTER_AUTH_SECRET` | Must match Mushak's secret |
| `BETTER_AUTH_URL` | Public URL of the Lokkhi backend |
| `FRONTEND_URL` | Public URL of the Lokkhi frontend |
| `TRUSTED_ORIGINS` | Extra origins for the auth API |
| `MAIL_DRIVER` | `console` or `smtp` |

## Separate server

Lokkhi is designed to be deployed on its own server:

- Serve the frontend from its own host.
- Proxy `/api` on that host to the Lokkhi backend.
- Point `BETTER_AUTH_URL` and `FRONTEND_URL` at the public URLs.
- Set `TRUSTED_ORIGINS` to the frontend origin in production.

Because a session cookie belongs to one origin, users sign in to Lokkhi on the
Lokkhi host. They use the same account as Mushak; they are not asked to create a
second one. If you later put both apps on subdomains of the same parent, a shared
cookie domain can remove the second sign-in, but it is not required.

The frontend never calls Mushak directly. It only talks to the Lokkhi backend,
which reads the shared database itself. That keeps CORS simple and means a Mushak
outage only disables suggestions, not invoicing.

## Packages

Lokkhi imports three workspace packages:

- `@ganesh/db` — Drizzle schema, client and migrations
- `@ganesh/shared` — invoice totals, numbering, line-status derivation
- `@ganesh/server` — Better Auth, guards, origins, mail

Build them before starting a backend:

```bash
npm run build:packages
```

## Migrations

The schema lives in `packages/db/src/schema.ts` and the migration journal in
`packages/db/drizzle/`. Generate and apply from an app that owns an env file:

```bash
npm run db:generate -w mushak/backend
npm run db:migrate -w mushak/backend
```

Both apps use the same history, so run this once.
