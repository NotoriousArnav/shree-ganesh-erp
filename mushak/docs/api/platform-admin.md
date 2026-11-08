# Platform admin API

All endpoints on this page require a signed-in `super_admin` or `dev` account.
Shop roles get `403`. The admin UI uses the same endpoints.

Common error responses:

| Status | Meaning |
| --- | --- |
| `400` | Validation failed or no changes supplied |
| `401` | Not signed in |
| `403` | Not a platform role |
| `404` | Merchant not found |
| `409` | Slug, email or phone already in use |

## List merchants

`GET /api/admin/merchants`

Returns every shop, newest name first, with all merchant columns:

```json
[
  {
    "id": "0c8a…",
    "name": "Ganesh Kirana",
    "slug": "ganesh-kirana",
    "gstin": "27AABCU9603R1ZM",
    "phone": "+919876543210",
    "currency": "INR",
    "address": { "line1": "12 Market Road", "city": "Pune" },
    "profileImageKey": null,
    "createdAt": "2026-11-01T08:00:00.000Z",
    "updatedAt": "2026-11-01T08:00:00.000Z"
  }
]
```

```bash
curl -s -b /tmp/mushak-admin.cookies \
  http://localhost:8080/api/admin/merchants
```

## Create a merchant

`POST /api/admin/merchants`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | Yes | 1 to 120 characters after trimming |
| `slug` | string | No | Lowercase letters, numbers and dashes; max 60; generated from the name when omitted |
| `gstin` | string \| null | No | Max 20 |
| `phone` | string \| null | No | Max 24 |
| `currency` | string | No | Max 8; defaults to `INR` |
| `address` | object \| null | No | String values, e.g. `line1`, `city` |

```bash
curl -s -b /tmp/mushak-admin.cookies \
  -H 'content-type: application/json' \
  -d '{"name":"Anime Point Siliguri","slug":"anime-point-siliguri","currency":"INR"}' \
  http://localhost:8080/api/admin/merchants
```

Returns `201` with the created merchant. A duplicate slug returns
`409 A merchant with that slug already exists`.

Creating a shop does **not** create a user. Add the owner next.

## Update a merchant

`PATCH /api/admin/merchants/{merchantId}`

Accepts any subset of `name`, `slug`, `gstin`, `phone`, `currency` and
`address`. An empty object returns `400 No changes supplied`.

```json
{
  "name": "Anime Point",
  "phone": "+919870000001",
  "currency": "INR"
}
```

Returns the updated merchant, or `404 Merchant not found`. Sending `null` for
`gstin`, `phone` or `address` clears the field.

Changing the currency does not convert stored prices.

## Create a shop owner

`POST /api/admin/merchants/{merchantId}/users`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | Yes | 1 to 120 characters |
| `email` | string | Yes | Valid email, max 160; stored lowercase |
| `password` | string | Yes | 8 to 128 characters |
| `phoneNumber` | string \| null | No | Max 24; non-digits removed |
| `permissions` | string[] | No | Any of `stock`, `catalogue`, `categories`; defaults to all |

```bash
curl -s -b /tmp/mushak-admin.cookies \
  -H 'content-type: application/json' \
  -d '{
    "name":"Deepak Kothiyal",
    "email":"deepak@anime-point.in",
    "password":"deepak-pass-123",
    "phoneNumber":"+919870000000",
    "permissions":["stock","catalogue","categories"]
  }' \
  http://localhost:8080/api/admin/merchants/<merchantId>/users
```

Returns `201`:

```json
{
  "id": "user_abc123",
  "name": "Deepak Kothiyal",
  "email": "deepak@anime-point.in",
  "phoneNumber": "+919870000000",
  "permissions": ["stock", "catalogue", "categories"],
  "active": true,
  "createdAt": "2026-11-08T10:00:00.000Z"
}
```

The account is created with the `merchant` role, so it always has full shop
access at runtime. The stored permission list is informational for owners.

`404 Merchant not found` when the shop id is unknown. `409` when the email or
phone is already used.

## List users

`GET /api/admin/users`

Returns every account, oldest first:

```json
[
  {
    "id": "user_abc123",
    "name": "Deepak Kothiyal",
    "email": "deepak@anime-point.in",
    "phoneNumber": "+919870000000",
    "role": "merchant",
    "merchantId": "0c8a…",
    "banned": false,
    "createdAt": "2026-11-08T10:00:00.000Z"
  }
]
```

The password hash and permission list are never returned by this endpoint.

## Not exposed

There is no API for deleting a merchant, editing a user's role, banning a user
or resetting an owner's password. Use the shop's staff endpoints for staff,
Drizzle Studio for role changes, and Better Auth's admin plugin if you need
impersonation. See [Managing users](../admin-guide/users.md).
