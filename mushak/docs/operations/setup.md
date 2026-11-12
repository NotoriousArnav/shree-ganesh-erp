# Local setup

This guide gets Mushak running from a clean checkout on a development machine.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 20 LTS or newer | The backend uses top-level await and modern ESM |
| npm | 10 or newer | Workspaces |
| Docker | Current | Postgres and RustFS |
| Git | Any recent | Checkout |

No global TypeScript, Drizzle or Vite install is needed; they are local
dependencies.

## 1. Install dependencies

From the repository root:

```bash
npm install
```

This installs the workspace dependencies for `mushak/frontend` and
`mushak/backend`.

## 2. Create the environment file

```bash
cp mushak/backend/.env.example mushak/backend/.env
```

Generate a secret instead of using the placeholder:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put the output in `BETTER_AUTH_SECRET`. Leave the rest of the development
defaults alone for a first run.

See [Configuration](configuration.md) for every variable.

## 3. Start Postgres and RustFS

```bash
npm run db:up
```

This runs `docker compose` in `mushak/backend` and starts:

| Container | Port | Purpose |
| --- | --- | --- |
| `mushak-db` | 5432 | PostgreSQL 17 |
| `mushak-rustfs` | 9000 | S3-compatible object storage |
| `mushak-rustfs` console | 9001 | Storage admin UI |

Check them:

```bash
docker compose -f mushak/backend/docker-compose.yml ps
```

Both should be `healthy`. The RustFS console is at http://localhost:9001 and
uses `S3_ACCESS_KEY` / `S3_SECRET_KEY` from the environment (default
`mushakadmin` / `mushak_dev_storage_secret`).

## 4. Apply migrations

```bash
npm run db:migrate
```

Migrations live in `mushak/backend/drizzle/`. The command reads
`DATABASE_URL` from `mushak/backend/.env`.

For schema work:

```bash
npm run db:generate -w mushak/backend   # write a new SQL migration
npm run db:migrate                      # apply it
```

`db:push` also exists for throwaway databases, but prefer generate + migrate so
the migration history stays correct.

## 5. Create the first administrator

Set these in `mushak/backend/.env`:

```dotenv
ADMIN_NAME=Super Admin
ADMIN_EMAIL=admin@mushak.local
ADMIN_PASSWORD=admin123
```

Then:

```bash
npm run seed:admin
```

The script creates the super admin or repairs an existing account's role. It is
safe to run again. Use a strong password outside development.

## 6. Optional demo data

```bash
npm run seed:demo
```

Creates a demo shop, categories, products, stock and two logins:

| Account | Password | Role |
| --- | --- | --- |
| `merchant@mushak.local` | `merchant-pass-123` | Merchant |
| `staff@mushak.local` | `staff-pass-123` | Staff |

All demo names, addresses and numbers are fictional. The seed is idempotent:
existing rows matched by slug, email or SKU are left alone.

## 7. Run the app

```bash
npm run dev:mushak
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8080 |
| Swagger UI | http://localhost:8080/docs |
| OpenAPI JSON | http://localhost:8080/openapi.json |
| Database health | http://localhost:8080/health/db |
| Storage health | http://localhost:8080/health/storage |
| RustFS console | http://localhost:9001 |

Vite proxies `/api` to `localhost:8080`, so the browser sees one origin in
development.

Run the halves separately when needed:

```bash
npm run dev:frontend
npm run dev:backend
```

## 8. Sign in

Open http://localhost:5173/login.

- Shop account → `/app`
- Platform account → `/admin`

If you seeded the demo data, use the merchant or staff credentials above. If
you only seeded the admin, sign in as the admin and create a shop from
**Add merchant**.

## 9. Verify

```bash
curl http://localhost:8080/health
curl http://localhost:8080/health/db
curl http://localhost:8080/health/storage
```

All three should report `ok`/`connected`. Then:

1. sign in as the merchant;
2. open **Catalogue**, add a product;
3. open **Inventory**, record a purchase;
4. check that the Dashboard total changes.

## Inspect the database

```bash
npm run db:studio
```

Drizzle Studio opens against `DATABASE_URL`. Use it to inspect rows and to change
roles or shop links, which have no UI.

## Common commands

| Command | Effect |
| --- | --- |
| `npm run db:up` | Start Postgres and RustFS |
| `npm run db:down` | Stop the containers, keep data |
| `npm run db:migrate` | Apply migrations |
| `npm run db:generate -w mushak/backend` | Generate a migration from the schema |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run seed:admin` | Create or repair the super admin |
| `npm run seed:demo` | Seed the demo shop |
| `npm run user:create -- …` | Provision a user from the CLI |
| `npm run user:reset-password -- …` | Reset a password from the CLI without mail |
| `npm run mail:test` | Send a sample message through the configured transport |
| `npm run build` | Build the frontend and backend |
| `npm run dev:mushak` | Run both dev servers |

## Production build

```bash
npm run build
```

Outputs:

- `mushak/frontend/dist` — static files;
- `mushak/backend/dist` — compiled Node ESM.

Start the backend with:

```bash
node mushak/backend/dist/index.js
```

The backend does not serve the frontend. Put both behind one origin and proxy
`/api`, `/health`, `/openapi.json`, `/docs` and `/mcp` to the backend. Set the
environment through the process manager, not a committed file.

Production checklist:

- `NODE_ENV=production`;
- a strong `BETTER_AUTH_SECRET` that is never rotated casually;
- `BETTER_AUTH_URL` and `FRONTEND_URL` set to the public origins;
- `TRUSTED_ORIGINS` for every extra frontend origin, or `*` to accept all;
- TLS at the proxy;
- real Postgres and object storage, with backups;
- `MAIL_DRIVER=smtp` with a verified sending domain before public password
  resets; see [Mail](mail.md).

## Reset a development environment

```bash
npm run db:down
docker volume rm mushak-db-data mushak-rustfs-data mushak-rustfs-logs
npm run db:up
npm run db:migrate
npm run seed:admin
npm run seed:demo
```

This deletes all local data. The volume names come from
`mushak/backend/docker-compose.yml`; Docker may prefix them with the compose
project name. List volumes with `docker volume ls` first.

## Troubleshooting setup

See [Operations troubleshooting](troubleshooting.md). The most common first-run
problems are a missing `.env`, a stopped database, and a port already in use.
