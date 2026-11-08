# Object storage API

Product images, inventory pictures and the shop profile picture live in
S3-compatible object storage. The API never stores image bytes in Postgres.

Every key is tenant-scoped. A merchant may only sign, read, list or delete keys
under its own `<merchantId>/` prefix.

| Operation | Path | Permission |
| --- | --- | --- |
| Status | `GET /api/storage/status` | Any shop role |
| Presign upload | `POST /api/storage/presign-upload` | `catalogue` |
| Presign download | `GET /api/storage/presign-download` | Any shop role |
| List objects | `GET /api/storage/objects` | Any shop role |
| Stream content | `GET /api/storage/objects/content` | Any shop role |
| Direct upload | `PUT /api/storage/objects` | `catalogue` |
| Delete | `DELETE /api/storage/objects` | `catalogue` |

If storage is not configured, every endpoint except status returns `503` with a
message naming the missing environment.

## Status

`GET /api/storage/status`

```json
{
  "driver": "s3",
  "bucket": "mushak",
  "endpoint": "http://localhost:9000",
  "configured": true,
  "reachable": true,
  "prefix": "0c8a…/"
}
```

`reachable` is `null` when storage is not configured, otherwise the result of a
bucket check. A missing bucket is created on first use.

```bash
curl -s -b /tmp/mushak.cookies \
  http://localhost:8080/api/storage/status
```

## Presign an upload

`POST /api/storage/presign-upload`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `filename` | string | Yes | 1 to 200 characters |
| `contentType` | string | No | Max 200; sent with the PUT |
| `prefix` | string | No | Folder under the merchant prefix, e.g. `products` |
| `expiresIn` | integer | No | 60 to 604,800 seconds; default 900 |

```bash
curl -s -b /tmp/mushak.cookies \
  -H 'content-type: application/json' \
  -d '{"filename":"rice.jpg","contentType":"image/jpeg","prefix":"products"}' \
  http://localhost:8080/api/storage/presign-upload
```

Returns:

```json
{
  "key": "0c8a…/products/2026-11/uuid-rice.jpg",
  "url": "http://localhost:9000/mushak/0c8a…/products/2026-11/uuid-rice.jpg?X-Amz-…",
  "method": "PUT",
  "expiresIn": 900,
  "headers": { "content-type": "image/jpeg" }
}
```

The key is built from the merchant prefix, the sanitised folder, the current
`YYYY-MM` folder, a UUID and the sanitised filename.

Upload the bytes directly to the returned URL:

```bash
curl -X PUT -H 'content-type: image/jpeg' \
  --data-binary @rice.jpg '<presigned url>'
```

Then save the `key` on a product:

```bash
curl -s -b /tmp/mushak.cookies -X PATCH \
  -H 'content-type: application/json' \
  -d '{"imageKey":"0c8a…/products/2026-11/uuid-rice.jpg"}' \
  http://localhost:8080/api/merchant/catalogue/<catalogueId>
```

The browser does the same PUT. CORS on the bucket must allow the frontend
origin; the driver writes that policy on first use from `TRUSTED_ORIGINS`.

## Presign a download

`GET /api/storage/presign-download?key=…`

| Query | Type | Required | Rules |
| --- | --- | --- | --- |
| `key` | string | Yes | Under the merchant prefix |
| `expiresIn` | integer | No | 60 to 604,800 seconds; default 900 |
| `downloadName` | string | No | Sets `content-disposition: attachment` |

Returns `{ "key": "…", "url": "https://…" }`.

## List objects

`GET /api/storage/objects?prefix=products&limit=100`

| Query | Type | Rules |
| --- | --- | --- |
| `prefix` | string | Relative to the merchant prefix; max 200 |
| `limit` | integer | 1 to 1000; default 100 |

Returns:

```json
{
  "prefix": "0c8a…/products",
  "objects": [
    {
      "key": "0c8a…/products/2026-11/uuid-rice.jpg",
      "size": 48213,
      "etag": "…",
      "lastModified": "2026-11-08T10:00:00.000Z"
    }
  ]
}
```

The server prepends the merchant prefix; you cannot list another shop's
objects.

## Stream content

`GET /api/storage/objects/content?key=…`

Returns the object bytes with its content type. This is what `<img src>`
uses so the page does not need a fresh presigned URL on every render.

- `cache-control: private, max-age=31536000, immutable`
- missing object → `404 { "error": "Image not found." }`
- key outside the prefix → `400`

```bash
curl -s -b /tmp/mushak.cookies \
  'http://localhost:8080/api/storage/objects/content?key=0c8a…/products/2026-11/uuid-rice.jpg' \
  --output rice.jpg
```

## Direct upload

`PUT /api/storage/objects?key=…`

For scripts and server-to-server uploads. Unlike the presigned flow, the bytes
pass through the API.

- body must be `application/octet-stream`;
- body limit is 25 MB;
- `contentType` query is optional; the request's content type is the fallback;
- returns `201` with `{ key, size, contentType, etag }`;
- a non-buffer body returns `415`.

```bash
curl -s -b /tmp/mushak.cookies -X PUT \
  -H 'content-type: application/octet-stream' \
  --data-binary @rice.jpg \
  'http://localhost:8080/api/storage/objects?key=0c8a…/products/2026-11/rice.jpg&contentType=image/jpeg'
```

Writing to an existing key replaces the object.

## Delete an object

`DELETE /api/storage/objects?key=…`

Returns `204` with no body. Deleting a missing object is not an error. The
product row keeps its `imageKey` until you clear it, so clear the field as well
if the image should disappear from the UI.

## Key safety

A key is rejected with `400` when it:

- does not start with `<merchantId>/`;
- contains `..`;
- contains a null byte;
- is empty.

The same check runs when a product or profile save includes an image key, so a
hand-edited form cannot point at another tenant's object.

## Errors

| Status | Meaning |
| --- | --- |
| `400` | Invalid query, invalid key, or bad body |
| `403` | Missing `catalogue` on upload/delete |
| `404` | Object not found (content stream only) |
| `415` | Direct upload body is not octet-stream |
| `503` | Storage is not configured |
