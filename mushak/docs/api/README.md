# API conventions

The Mushak API is a JSON HTTP API served by the Fastify backend. The canonical
machine-readable contract is the
[OpenAPI document](openapi.json), also served live at `/openapi.json` with
Swagger UI at `/docs`.

## Base URL

| Environment | Base URL |
| --- | --- |
| Local development | `http://localhost:8080` |
| Deployed | The origin that serves the API, e.g. `https://mushak.example.com` |

All examples in this documentation use `http://localhost:8080`. Paths are
case-sensitive.

## Content type

Send `content-type: application/json` whenever there is a body. The backend
rejects an empty body that claims to be JSON, so do not send the header on a
bodyless `GET` or `DELETE`.

Responses are JSON except:

- `GET /api/storage/objects/content` streams image bytes;
- `DELETE /api/storage/objects` returns `204` with no body;
- Swagger UI serves HTML.

## Authentication

Mushak uses database-backed sessions from Better Auth. Signing in sets an
http-only cookie named `better-auth.session_token`. Send it on every request.

### curl sessions

Use a cookie jar so the cookie survives between commands:

```bash
BASE=http://localhost:8080
JAR=/tmp/mushak.cookies

curl -s -c "$JAR" -H 'content-type: application/json' \
  -d '{"email":"merchant@mushak.local","password":"merchant-pass-123"}' \
  "$BASE/api/auth/sign-in/email"

curl -s -b "$JAR" "$BASE/api/merchant/profile"
```

Add `-b "$JAR" -c "$JAR"` when a call may refresh the cookie.

In a browser, send requests with `credentials: "include"` (the frontend's API
helper does this).

### Who may call what

| Area | Path prefix | Allowed roles |
| --- | --- | --- |
| Auth | `/api/auth/*` | Public, except session and sign-out |
| Health and OpenAPI | `/health*`, `/openapi.json`, `/docs` | Public |
| Merchant | `/api/merchant/*` | `merchant`, `staff` with the required permission |
| Storage | `/api/storage/*` | `merchant`, `staff`; uploads need `catalogue` |
| Platform admin | `/api/admin/*` | `super_admin`, `dev` |
| MCP | `/mcp` | Public; only exposes a health tool |

A signed-in account with the wrong role gets `403`. No cookie, an expired
session or a banned account gets `401`.

## Tenancy

The shop is taken from the session, never from the request body or query.

- Shop users can only read and write rows for their own `merchant_id`.
- Platform roles cannot use `/api/merchant`; they use `/api/admin`.
- A row id belonging to another shop behaves as **not found** (`404`), not
  forbidden.
- Image keys must start with the caller's `<merchantId>/` prefix.

## Request and response shapes

- Field names are camelCase in JSON.
- Ids are UUID strings, except Better Auth user ids which are opaque strings.
- Timestamps are ISO 8601 strings with a time zone.
- Money is a JSON number with up to 2 decimal places.
- Quantities are JSON numbers with up to 3 decimal places.
- Optional database fields are `null`, not omitted.
- Lists are plain arrays; there is no envelope. Only stock movements support a
  limit.

### The product shape

Catalogue and inventory list items share one shape. The difference is which id
is returned:

- catalogue endpoints return `id` = catalogue item id;
- inventory endpoints return `id` = inventory row id.

```json
{
  "id": "b6f2…",
  "catalogueItemId": "b6f2…",
  "merchantId": "0c8a…",
  "categoryId": "a11e…",
  "name": "Basmati rice 5 kg",
  "sku": "BASMATI-RICE-5",
  "barcode": null,
  "unit": "kg",
  "hsnCode": "1006",
  "taxRate": 5,
  "purchasePrice": 95,
  "sellingPrice": 120,
  "attributes": null,
  "imageKey": "0c8a…/products/2026-11/uuid-basmati.jpg",
  "isActive": true,
  "createdAt": "2026-11-08T09:12:00.000Z",
  "updatedAt": "2026-11-08T09:12:00.000Z",
  "inventoryItemId": "f93d…",
  "inventoryImageKey": null,
  "stockQty": 25,
  "reorderLevel": 10,
  "categoryName": "Grains"
}
```

## Errors

Application errors use one shape:

```json
{ "error": "A category with that name already exists" }
```

Validation errors prefix the field path:

```json
{ "error": "name: Name is required" }
```

Better Auth endpoints return its own shape, typically:

```json
{ "message": "Invalid email or password", "code": "INVALID_EMAIL_OR_PASSWORD" }
```

| Status | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Created |
| `204` | Deleted, no body |
| `400` | Validation failed, bad key, or stock would go negative |
| `401` | Not signed in, session expired, account banned |
| `403` | Signed in but missing the role or permission |
| `404` | Row not found **in this shop** |
| `409` | Duplicate SKU, barcode, category name or slug |
| `415` | Storage upload body was not `application/octet-stream` |
| `503` | Storage or database unavailable |

## Units

The unit is a fixed enum:

```
pcs, kg, g, litre, ml, box, packet, dozen, bundle, metre, sqft
```

## Money and tax

- `purchasePrice` and `sellingPrice` are 0 to 10,000,000.
- `taxRate` is a percentage from 0 to 100.
- `currency` on the shop is a display label. The API does not convert values.

## SKU and barcode

- Both are optional and unique per shop.
- An omitted or blank `sku` is generated from the name. The generator keeps
  letters, Indic marks and digits, joins words with `-`, limits to 24
  characters, and adds `-2`, `-3` on collision.
- An omitted or blank `barcode` stays `null`.
- Duplicates return `409`.

## Archive instead of delete

`DELETE /api/merchant/catalogue/{id}` and
`DELETE /api/merchant/inventory/{id}` archive the product by setting
`isActive=false`. Stock rows and movements remain. Send
`PATCH …/{id}` with `{"isActive":true}` to restore it.

Categories are deleted for real; products in them keep existing and become
uncategorised.

## Filters

Catalogue and inventory list endpoints accept:

| Query | Applies to | Effect |
| --- | --- | --- |
| `q` | Both | Case-insensitive match on name, SKU or barcode. |
| `categoryId` | Both | Exact category UUID. |
| `includeInactive=true` | Both | Include archived products. |
| `lowStock=true` | Inventory only | Quantity at or below a positive reorder level. |

`GET /api/merchant/movements` accepts `limit` from 1 to 200 (default 50).

## OpenAPI

- Live document: `GET /openapi.json`
- Swagger UI: `GET /docs`
- Checked-in copy: [`openapi.json`](openapi.json)

Regenerate the checked-in copy with:

```bash
npm run docs:openapi
```

The export reads the spec from the backend source, so it works without a
running server.

## Versioning

The API is at `0.1.0`. There is no version prefix in the path. Breaking changes
would ship with a new major version and a note in this documentation.
