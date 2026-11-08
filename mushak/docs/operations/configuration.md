# Configuration

All backend settings come from environment variables. In development they are
read from `mushak/backend/.env` through `dotenv`. In production set them in the
process manager or container environment.

The frontend has no runtime environment file; it calls relative `/api` URLs and
relies on the dev proxy or the production reverse proxy.

## Server

| Variable | Default | Required | Notes |
| --- | --- | --- | --- |
| `HOST` | `0.0.0.0` | No | Listen address. Use `127.0.0.1` behind a local proxy. |
| `PORT` | `8080` | No | Backend port. |
| `NODE_ENV` | unset | Recommended | `production` disables LAN auto-trust and enables production behaviour. |

## Database

| Variable | Default | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | none | Yes | `postgres://user:pass@host:5432/db`. The app refuses to start without it. |
| `POSTGRES_USER` | `mushak` | Compose only | Used by the bundled container. |
| `POSTGRES_PASSWORD` | `mushak_dev_password` | Compose only | Change outside development. |
| `POSTGRES_DB` | `mushak` | Compose only | Database name. |
| `POSTGRES_PORT` | `5432` | Compose only | Host port mapping. |

The client uses `max: 1` and `prepare: false`, so it works with transaction-mode
poolers such as PgBouncer, Neon and Supabase. A managed database only needs a
different `DATABASE_URL`.

## Authentication

| Variable | Default | Required | Notes |
| --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | none | Yes in practice | 32 random bytes, base64url. Changing it invalidates every session. |
| `BETTER_AUTH_URL` | `http://localhost:8080` | Yes | Public backend origin; used as the auth base URL. |
| `FRONTEND_URL` | `http://localhost:5173` | Yes | Public frontend origin; trusted for auth and storage CORS. |
| `TRUSTED_ORIGINS` | empty | For extra origins | Comma-separated list, e.g. `https://shop.example.com,http://192.168.1.42:5173`. |

Origins are normalised without a trailing slash. In development, every LAN IPv4
address of the machine is added automatically on the frontend's port, so a phone
on the same Wi-Fi can sign in after a router address change. `NODE_ENV=production`
turns that off.

## First administrator

Used only by `npm run seed:admin`.

| Variable | Default | Notes |
| --- | --- | --- |
| `ADMIN_NAME` | `Super Admin` | Display name |
| `ADMIN_EMAIL` | none | Required by the script |
| `ADMIN_PASSWORD` | none | Required when creating; the script exits without both |

Remove or rotate the admin password after the first sign-in.

## Mail

| Variable | Default | Notes |
| --- | --- | --- |
| `MAIL_DRIVER` | `console` | Only `console` is implemented. Any other value throws. |
| `MAIL_FROM` | `Mushak <no-reply@mushak.local>` | From header. |
| `MAIL_DIR` | `/tmp/mushak-mail` | Where the console mailer writes `.eml` and `.json` files. |

See [Mail](mail.md).

## Object storage

| Variable | Default | Required | Notes |
| --- | --- | --- | --- |
| `STORAGE_DRIVER` | `s3` | No | Only `s3` is implemented. |
| `S3_ENDPOINT` | none | For self-hosted | e.g. `http://localhost:9000`. Omit for AWS S3. |
| `S3_REGION` | `us-east-1` | No | Must match the provider when it matters. |
| `S3_ACCESS_KEY` | none | Yes | Bucket credential. |
| `S3_SECRET_KEY` | none | Yes | Bucket secret. |
| `S3_BUCKET` | none | Yes | Bucket name; created on first use. |
| `S3_FORCE_PATH_STYLE` | `true` | No | Path-style addressing; required by RustFS and MinIO, optional for AWS. Set `false` for virtual-host style. |
| `S3_PUBLIC_URL` | none | No | CDN or public bucket base for permanent links. Without it, presigned URLs are used. |
| `S3_PORT` | `9000` | Compose only | Host port for RustFS. |
| `S3_CONSOLE_PORT` | `9001` | Compose only | Host port for the RustFS console. |

If any of `S3_BUCKET`, `S3_ACCESS_KEY` or `S3_SECRET_KEY` is missing, storage
calls return `503`; the rest of the app still runs.

## Frontend

The frontend has no `.env`. These are fixed in code:

| Setting | Value |
| --- | --- |
| Dev host | `0.0.0.0` |
| Dev port | `5173` |
| API proxy | `/api` → `http://localhost:8080` |
| PWA | Auto-update service worker, standalone display |

For a production deployment, configure the same proxy at the web server. If the
frontend and backend are on different origins, set `TRUSTED_ORIGINS` and use
credentials on requests.

## Compose-only variables

`mushak/backend/docker-compose.yml` reads:

| Variable | Services |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | `db` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PORT`, `S3_CONSOLE_PORT` | `rustfs` |

The same file sets `RUSTFS_VOLUMES`, path-style compatibility and the console
address. Do not expose port 9000 publicly without credentials.

## Example production environment

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8080

DATABASE_URL=postgres://mushak:strong-password@db.internal:5432/mushak

BETTER_AUTH_SECRET=<32-byte-base64url>
BETTER_AUTH_URL=https://mushak.example.com
FRONTEND_URL=https://mushak.example.com
TRUSTED_ORIGINS=https://shop.example.com

MAIL_DRIVER=console
MAIL_FROM=Mushak <no-reply@mushak.example.com>
MAIL_DIR=/var/lib/mushak/mail

STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.example.com
S3_REGION=ap-south-1
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_BUCKET=mushak
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_URL=https://cdn.example.com/mushak
```

Because only the console mailer exists, a public deployment cannot deliver
password-reset mail yet. Plan for SMTP before exposing self-service resets. See
[Mail](mail.md).

## Secret handling

- Never commit `.env`; only `.env.example` belongs in the repository.
- Use the process manager's secret store in production.
- Do not log environment values.
- Rotating `BETTER_AUTH_SECRET` signs everyone out.
- Rotating storage keys requires updating the bucket policy too.
- Database credentials belong to the app only; do not reuse the superuser.
