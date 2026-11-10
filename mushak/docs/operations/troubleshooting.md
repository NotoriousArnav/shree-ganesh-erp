# Operations troubleshooting

Server-side diagnosis for a running or failing Mushak installation. For
user-facing problems, see [User troubleshooting](../user-guide/11-troubleshooting.md).

## First checks

```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8080/health/db
curl -s http://localhost:8080/health/storage
docker compose -f mushak/backend/docker-compose.yml ps
```

| Result | Meaning |
| --- | --- |
| `/health` fails | Backend is not running or the port is wrong |
| `/health/db` returns 503 | Postgres is down, unreachable, or `DATABASE_URL` is wrong |
| `/health/storage` returns 503 | Storage is unconfigured or the bucket is unreachable |
| All three pass | The API is up; the problem is above the API (proxy, frontend, browser) |

## Backend will not start

Check the process output first. Common causes:

| Message | Cause | Fix |
| --- | --- | --- |
| `DATABASE_URL is not set` | Missing `.env` or environment | Copy `.env.example`; set the variable |
| `Unsupported MAIL_DRIVER` | A driver other than `console` or `smtp` | Use `console`, `smtp`, or add a transport |
| `Unsupported STORAGE_DRIVER` | A driver other than `s3` | Use `s3` |
| `EADDRINUSE` | Port 8080 is taken | Stop the other process or set `PORT` |
| `password authentication failed` | Wrong database credentials | Fix `DATABASE_URL` |
| `getaddrinfo ENOTFOUND` | Wrong database host | Check DNS/network |
| `relation … does not exist` | Migrations not applied | `npm run db:migrate` |

Run the compiled backend directly to see errors without a watcher:

```bash
node mushak/backend/dist/index.js
```

## Frontend cannot reach the API

In development Vite proxies `/api` to `http://localhost:8080`.

- Is the backend on 8080?
- Did you change `PORT`? Update `mushak/frontend/vite.config.ts`.
- Are requests going to `/api/...` relative paths? They should; there is no
  hard-coded backend URL.
- In production, does the web server proxy `/api`, `/health`, `/openapi.json`,
  `/docs` and `/mcp` to the backend?

A browser CORS error means the request is going cross-origin. The auth layer
only trusts configured origins. Add the frontend origin to `TRUSTED_ORIGINS`
and restart.

## Sign-in loops or 401s

| Check | Detail |
| --- | --- |
| Cookie present? | Browser devtools → Application → Cookies → `better-auth.session_token` |
| Host consistent? | `localhost` and `127.0.0.1` do not share cookies |
| Secret stable? | A changed `BETTER_AUTH_SECRET` invalidates sessions |
| Backend time | Large clock skew can expire sessions early |
| Account banned? | The API returns `403` with a deactivation message |
| Shop link present? | Shop roles need `users.merchant_id` |
| Proxy strips cookies? | Ensure `Set-Cookie` and `Cookie` pass through |

After fixing a role or shop link in the database, sign out and in again.

## 403s for a shop user

The API returns 403 for:

- a platform role calling a shop endpoint;
- a staff account missing `stock`, `catalogue` or `categories`;
- a banned account;
- a shop account with no `merchant_id`;
- a shop role calling the admin API.

Check the `error` body; the messages distinguish these. Verify the permission
list in **Staff → Edit**, or inspect `users.staff_permissions` in Drizzle Studio.

## Migrations fail

```bash
npm run db:migrate
```

| Error | Cause |
| --- | --- |
| `database … does not exist` | Create it or fix `DATABASE_URL` |
| `relation already exists` | The database has drift; compare with `drizzle/meta` |
| `permission denied` | The database user lacks DDL rights |
| Checksum/migration mismatch | Someone edited an applied migration; restore or reconcile manually |

For a development database you can reset the volumes (see
[Local setup](setup.md#reset-a-development-environment)). Never do that in
production.

Generate a migration after schema changes:

```bash
npm run db:generate -w mushak/backend
```

Review the generated SQL before applying it.

## Storage failures

| Symptom | Check |
| --- | --- |
| 503 “Object storage is not configured” | `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| `/health/storage` 503 | Container health, endpoint, credentials |
| Upload 403 from the browser | Bucket CORS; restart after changing origins |
| `SignatureDoesNotMatch` | Secret, region, path-style setting, clock skew |
| Missing images | Object deleted; restore the bucket backup |
| Bucket does not exist | The driver creates it on first use; check IAM rights |

Inspect the bucket directly with the RustFS console or:

```bash
aws --endpoint-url http://localhost:9000 s3 ls s3://mushak/
```

## Mail problems

Start with `MAIL_DRIVER`.

- `console` prints the message in the backend terminal and writes files under
  `MAIL_DIR` (`/tmp/mushak-mail`).
- `smtp` sends through `SMTP_HOST`. Check the backend log for the provider's
  error code; `EAUTH`, `ETIMEDOUT` and certificate errors are the usual causes.
- `npm run mail:test -- you@example.com` isolates mail from the reset flow.

See [Mail](mail.md) for configuration, provider recipes and the reset flow.

## Ports and containers

```bash
ss -ltnp | grep -E '5173|8080|5432|9000|9001'
docker compose -f mushak/backend/docker-compose.yml logs --tail=100 db
docker compose -f mushak/backend/docker-compose.yml logs --tail=100 rustfs
```

Stop a conflicting process or change the port in both the app and the proxy.

`npm run db:down` keeps the volumes. `docker compose down -v` deletes them; use
it only when you intend to lose data.

## Slow responses

- `postgres.js` is configured with `max: 1`. That is deliberate for serverless
  compatibility but limits concurrency on a single process; run more processes
  behind a proxy if needed.
- Lists are not paginated. A shop with tens of thousands of products will make
  Catalogue and Inventory slow.
- The Dashboard runs several aggregate queries per load and does not cache.
- Image bytes go through the API content endpoint; a CDN (`S3_PUBLIC_URL` plus a
  frontend change) would offload them.
- Check the slow query log in Postgres before changing indexes.

## Disk and growth

Watch:

- the Postgres volume (`stock_movements` grows forever);
- the RustFS volume (images are never pruned automatically);
- `MAIL_DIR` (console mail accumulates);
- backend logs.

There is no pruning job. Archive products rather than deleting rows, and plan
storage capacity.

## Security incident checklist

1. Rotate `BETTER_AUTH_SECRET`; this signs everyone out.
2. Rotate database and storage credentials.
3. Deactivate or ban the affected accounts.
4. Preserve logs and take a database snapshot before changing more.
5. Check `users.role` for unexpected platform roles.
6. Review `users.merchant_id` links for cross-shop access.
7. Restore from a known-good backup if data was altered.
8. Tell affected shops what happened and what to do next.

## Collecting a support bundle

```bash
{
  date
  node --version
  npm --version
  git rev-parse HEAD
  curl -s http://localhost:8080/health
  curl -s http://localhost:8080/health/db
  curl -s http://localhost:8080/health/storage
  docker compose -f mushak/backend/docker-compose.yml ps
} > mushak-diagnostics.txt
```

Remove secrets, emails and phone numbers before sharing the file.

## Useful commands

| Command | Use |
| --- | --- |
| `npm run db:logs` | Follow Postgres container logs |
| `npm run db:studio` | Inspect and edit rows |
| `npm run db:generate -w mushak/backend` | Create a migration |
| `npm run db:migrate` | Apply migrations |
| `npm run seed:admin` | Repair the platform administrator |
| `npm run user:create -- …` | Provision a user |
| `npm run mail:test` | Check the mailer |
| `npm run build` | Catch type and build errors |
