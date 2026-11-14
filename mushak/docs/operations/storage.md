# Object storage

Mushak keeps image bytes in S3-compatible object storage and keeps only the
object key in Postgres. This keeps the database small and lets a CDN or bucket
policy serve files later.

## Supported backends

| Backend | Notes |
| --- | --- |
| RustFS | Bundled in `docker-compose.yml`; development default |
| MinIO | Works with `S3_ENDPOINT` and path-style addressing |
| Backblaze B2 | Works with the regional `s3.<region>.backblazeb2.com` endpoint; private buckets are fine |
| AWS S3 | Omit `S3_ENDPOINT`; usually `S3_FORCE_PATH_STYLE=false` |
| Ceph RGW and other S3 APIs | Works when path-style and signature settings match |

Only `STORAGE_DRIVER=s3` is implemented.

## Configuration

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

Start the bundled server with `npm run db:up`. The console is at
http://localhost:9001.

The bucket named by `S3_BUCKET` is created on first use.

## Key layout

Every key is under the shop's own prefix:

```
<merchantId>/<folder>/<YYYY-MM>/<uuid>-<filename>
```

Examples:

```
0c8a…/products/2026-11/4f2c…-rice.jpg
0c8a…/profile/2026-11/9a11…-shop.png
0c8a…/inventory/2026-11/77de…-pack.jpg
```

- The folder comes from the `prefix` parameter on the upload request and is
  sanitised; slashes become nested folders.
- The UI uses `products` for catalogue images, `profile` for the shop picture,
  and `inventory` for stock images.
- `filename` is normalised to a slug; the UUID prevents collisions.
- `dateFolder()` uses `YYYY-MM`.

`S3_PUBLIC_URL` is read by the storage helper for permanent links, but the
current UI always renders images through the authenticated content endpoint.

## Upload flow

```
Browser                    API                        Object storage
  │  POST uploads (bytes)    │                              │
  ├─────────────────────────►│  build tenant key            │
  │                          ├─────────────────────────────►│  store
  │  { key, size, etag }     │                              │
  │◄─────────────────────────┤                              │
  │  PATCH product { imageKey: key }                        │
  ├─────────────────────────►│  validate prefix, save key   │
```

Browser uploads pass through the API, so the bucket never sees a browser
request and needs no CORS policy. The 5 MB image limit keeps the extra hop
cheap.

Scripts and non-browser clients can still ask for a presigned PUT, or use the
direct `PUT /api/storage/objects` path. Both are limited to 25 MB.

## Browser limits

The image component accepts:

| Rule | Value |
| --- | --- |
| Types | `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/avif` |
| Maximum size | 5 MB |
| Upload | `POST /api/storage/uploads`, then save the key |

The server does not inspect image contents; the browser type and size checks are
a usability guard. Treat uploaded files as untrusted if you later process them.

## Reading images

`GET /api/storage/objects/content?key=…` streams the object through the API.

- It requires a shop session.
- It checks the key prefix, then `HEAD`s the object.
- It returns `404 Image not found.` if the key outlives the object.
- It sets `cache-control: private, max-age=31536000, immutable`.

The UI uses this same-origin URL, so `<img>` tags work without a fresh presigned
URL per render.

## CORS

None is required. The browser only calls the Mushak API, and the API writes and
reads objects with server-side credentials. This works with private buckets,
including Backblaze B2 and the RustFS/MinIO defaults.

CORS is still enabled on the API itself so browser apps on other origins can
call it. That is an API policy, separate from the bucket.

## AWS S3 example

```dotenv
STORAGE_DRIVER=s3
S3_REGION=ap-south-1
S3_ACCESS_KEY=AKIA…
S3_SECRET_KEY=…
S3_BUCKET=mushak-prod
S3_FORCE_PATH_STYLE=false
# S3_ENDPOINT is unset
```

The IAM user needs at least:

- `s3:ListBucket` on the bucket;
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `bucket/*`;
- bucket creation if the bucket does not exist (`s3:CreateBucket`).

No bucket CORS permission is needed.

## Tenancy and safety

- A key must start with `<merchantId>/`.
- `..` and null bytes are rejected.
- The same validation runs when a product or merchant record saves an image key.
- Listing prepends the merchant prefix; you cannot list another shop's objects.
- Direct uploads and deletes require the `catalogue` permission.

## Backups

Images are not in Postgres. Back up the bucket separately:

```bash
aws s3 sync s3://mushak /backup/mushak-images --delete
# or, for RustFS, back up the named volume
docker run --rm -v mushak-rustfs-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/rustfs-data.tar.gz -C /data .
```

A database restore without the matching bucket leaves image keys pointing at
missing objects. The app handles that with a 404 and a placeholder, but the
pictures are gone.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `/health/storage` is 503 | `S3_BUCKET`, keys, endpoint, container |
| Upload works in API but not browser | API CORS or the signed-in session; bucket CORS is not involved |
| `403 SignatureDoesNotMatch` | Wrong secret, region or path-style setting |
| Images show a broken tile | Missing object, wrong key, or storage is down |
| Bucket is created but listing is empty | The prefix is relative to the merchant prefix |
| `S3_FORCE_PATH_STYLE` mismatch | RustFS/MinIO need `true`; AWS usually `false` |

See [Object storage API](../api/storage.md) for request shapes.
