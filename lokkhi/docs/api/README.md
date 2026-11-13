# Lokkhi API

The Lokkhi backend serves the invoice API on port `8081` by default. The
canonical specification is [openapi.json](openapi.json); this page explains the
shape and the rules that matter when integrating.

## Authentication

Lokkhi uses the same Better Auth tables as Mushak. Sign in against **Lokkhi's own
backend**:

```text
POST /api/auth/sign-in/email
POST /api/auth/sign-in/phone-number
GET  /api/auth/get-session
POST /api/auth/sign-out
```

Lokkhi runs on its own origin and owns its own session cookie. Because the
database is shared, the same user and merchant exist in both apps, but a session
created in Mushak is not reused by Lokkhi. Signing in to each app is expected.

Every `/api/merchant/*` route requires a signed-in `merchant` or `staff` account
linked to a merchant. The merchant id comes from the session, never from the
request body or query string.

`/api/public/invoices/:id` is the one deliberate exception. It powers the
`/invoices/:id?anon=true` share page, so it needs no session. It returns only the
fields printed on the document and omits merchant ids, catalogue links and stock
sync state.

## Conventions

- JSON in, JSON out.
- Money is a number with two decimals; currency defaults to `INR`.
- Dates are `YYYY-MM-DD` strings. Timestamps are ISO 8601.
- Errors use `{ "error": "message" }` with a 4xx status.
- Totals are always recomputed on the server. Client-sent totals are ignored.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/merchant/invoices` | List and filter invoices |
| `POST` | `/api/merchant/invoices` | Create a draft |
| `GET` | `/api/merchant/invoices/:id` | Detail with derived line hints |
| `PATCH` | `/api/merchant/invoices/:id` | Update a draft |
| `DELETE` | `/api/merchant/invoices/:id` | Delete a draft |
| `POST` | `/api/merchant/invoices/:id/issue` | Number, freeze, attempt stock |
| `POST` | `/api/merchant/invoices/:id/void` | Void and reverse stock best-effort |
| `POST` | `/api/merchant/invoices/:id/lines/:lineId/retry-stock` | Retry one line |
| `POST` | `/api/merchant/invoices/:id/lines/:lineId/add-to-mushak` | Create and link a Mushak item |
| `GET` | `/api/merchant/invoices/suggestions?q=` | Catalogue search |
| `GET` | `/api/public/invoices/:id` | Read-only invoice behind a share link |

See [Invoices](invoices.md) for request and response examples.

## The redundancy contract

Integrators can rely on these guarantees:

1. `catalogueItemId` is optional in every line payload.
2. An unknown or stale `catalogueItemId` is treated as a manual line, not an
   error.
3. An invoice with only manual lines issues normally.
4. Issue-time stock failures are reported on the line and never change the HTTP
   outcome from success to failure.
5. Issued invoice snapshots are immutable, including after the catalogue item is
   edited, archived or deleted.

The last point is why `invoice_lines.catalogue_item_id` is `ON DELETE SET NULL`:
the link may disappear, the snapshot may not.

## Health

```text
GET /health       → { "status": "ok", "app": "lokkhi" }
GET /health/db    → database reachability
GET /openapi.json → the specification
GET /docs         → Swagger UI
```
