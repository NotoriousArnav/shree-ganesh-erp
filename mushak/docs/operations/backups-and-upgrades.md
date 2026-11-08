# Backups and upgrades

Two things hold state: PostgreSQL and object storage. Back up both or accept
that images will break.

## What to back up

| Item | Why |
| --- | --- |
| PostgreSQL database | Shops, products, stock, movements, users, sessions |
| Object storage bucket or volume | Product, inventory and profile images |
| Backend environment / secrets | Cannot be recovered from the database |
| Frontend build or repository | Reproducible from source, but keep the deployed version |

Sessions live in the database. A restore may sign users out if the session rows
are old or expired.

## Database backup

### Local Docker

```bash
mkdir -p backups
docker exec mushak-db pg_dump -U mushak -d mushak -Fc \
  > "backups/mushak-$(date +%F-%H%M).dump"
```

`-Fc` is a compressed custom-format dump, suitable for `pg_restore`.

### Managed Postgres

Use the provider's snapshot feature and also keep a logical dump:

```bash
pg_dump "$DATABASE_URL" -Fc -f backups/mushak.dump
```

### Verify a backup

A backup you have not restored is a hope. Periodically restore into a scratch
database:

```bash
docker exec -i mushak-db createdb -U mushak mushak_restore_test
docker exec -i mushak-db pg_restore -U mushak -d mushak_restore_test \
  < backups/mushak.dump
docker exec -i mushak-db psql -U mushak -d mushak_restore_test \
  -c 'select count(*) from merchants;'
docker exec -i mushak-db dropdb -U mushak mushak_restore_test
```

For a custom-format file, `pg_restore` reads from stdin with `-` when piped, as
above, or from a mounted path.

## Object storage backup

### RustFS volume

```bash
docker run --rm \
  -v mushak-rustfs-data:/data \
  -v "$PWD/backups":/backup \
  alpine tar czf /backup/rustfs-data.tar.gz -C /data .
```

Stop writes or accept a fuzzy copy across files.

### S3 or compatible

```bash
aws s3 sync s3://mushak "backups/s3/mushak" --delete
```

For versioned buckets, enable versioning and lifecycle rules instead of relying
only on sync.

### Restore

```bash
aws s3 sync "backups/s3/mushak" s3://mushak
# or stop the container and unpack into the volume
```

Restore the database and the bucket from the same point in time when possible.
A mismatch leaves image keys pointing at the wrong objects.

## Retention

A practical scheme:

| Copy | Frequency | Keep |
| --- | --- | --- |
| Database dump | Daily | 14 days |
| Database dump | Weekly | 8 weeks |
| Bucket sync | Daily | 14 days |
| Off-site copy | Weekly | 3 months |

Encrypt backups at rest and restrict who can read them: they contain password
hashes, emails, phone numbers and shop data.

## Restore procedure

1. Announce a maintenance window; stop the backend.
2. Take a fresh dump of the current database, even if it is broken.
3. Restore the chosen dump into the database.
4. Restore the bucket or volume.
5. Start the backend and check `/health`, `/health/db`, `/health/storage`.
6. Sign in as an owner, open Inventory and a product detail page.
7. Check that images load and stock quantities match the movement history.

If the restore is wrong, the pre-restore dump is the way back.

## Upgrading the application

### 1. Read the changes

Check for:

- new environment variables;
- new migrations;
- changed API shapes;
- Node or dependency version requirements.

### 2. Back up

Always take a database dump before migrating.

### 3. Install and build

```bash
npm install
npm run build
```

### 4. Apply migrations

```bash
npm run db:migrate
```

Migrations run in order from `mushak/backend/drizzle/`. Apply them before
starting the new backend so the code matches the schema.

### 5. Start and verify

```bash
node mushak/backend/dist/index.js
```

Check the health endpoints and sign in. Watch the log for the first few requests.

### 6. Refresh clients

The frontend is a PWA with auto-update. Users may need to close and reopen the
app, or hard-reload, to pick up a new build. A changed API contract can leave an
old tab calling a removed shape; ask users to reload after a deploy.

## Rolling back

- **Code only:** redeploy the previous build. Usually safe if the schema did not
  change.
- **Schema change:** restore the matching database dump. Some migrations are
  forward-only; do not assume the old code can read the new schema.
- **Storage:** restore the bucket snapshot that matches the database.

Keep the previous build artifact until the new one has been healthy for a full
business day.

## Dependency updates

- Update the frontend and backend workspaces together; they share React,
  TypeScript and Better Auth versions in places.
- Run `npm run build` after updating; TypeScript catches most API drift.
- Read release notes for Better Auth and Drizzle; both touch auth and schema.
- Re-run the manual flows: sign in, reset password (console mail), add product,
  move stock, upload image.
- Do not update `@fastify/swagger` and `@fastify/swagger-ui` independently of
  Fastify without checking compatibility.

## Secret rotation

| Secret | Effect |
| --- | --- |
| `BETTER_AUTH_SECRET` | Every session becomes invalid; users sign in again |
| Database password | Update the app and the database together |
| Storage keys | Update the bucket user and the app; presigned URLs fail until both match |
| Admin password | Change it in the database or reset it through Better Auth |

Rotate `BETTER_AUTH_SECRET` during a maintenance window and expect a sign-in
wave.

## Upgrade checklist

- [ ] Backup database and bucket
- [ ] Record the current commit and build artifact
- [ ] Review new environment variables
- [ ] Apply migrations
- [ ] Deploy the backend
- [ ] Deploy the frontend
- [ ] Check `/health`, `/health/db`, `/health/storage`
- [ ] Sign in as merchant and admin
- [ ] Add a product, move stock, upload an image
- [ ] Ask a staff account to sign in
- [ ] Watch logs for errors for 15 minutes
