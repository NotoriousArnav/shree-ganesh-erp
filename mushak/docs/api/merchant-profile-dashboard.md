# Merchant profile and dashboard API

Both endpoints are scoped to the shop on the session. Every shop role can read
them; only the shop owner can change the profile.

## Get the profile

`GET /api/merchant/profile`

Returns the shop and the signed-in user's effective access:

```json
{
  "merchant": {
    "id": "0c8a…",
    "name": "Ganesh Kirana",
    "slug": "ganesh-kirana",
    "gstin": "27AABCU9603R1ZM",
    "phone": "+919876543210",
    "currency": "INR",
    "address": { "line1": "12 Market Road", "city": "Pune" },
    "profileImageKey": "0c8a…/profile/2026-11/uuid-shop.jpg",
    "createdAt": "2026-11-01T08:00:00.000Z",
    "updatedAt": "2026-11-08T09:00:00.000Z"
  },
  "user": {
    "id": "user_abc123",
    "name": "Shop Owner",
    "role": "merchant",
    "permissions": ["stock", "catalogue", "categories"]
  }
}
```

`merchant` is `null` only if the session points at a shop that no longer
exists. `user.permissions` is the effective list; a merchant always receives
all three.

The frontend uses this response for the sidebar, the shop name and permission
checks.

```bash
curl -s -b /tmp/mushak.cookies \
  http://localhost:8080/api/merchant/profile
```

## Update the profile

`PATCH /api/merchant/profile`

Requires the **merchant** role. Staff get `403`.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | 1 to 120 characters |
| `phone` | string \| null | Max 24 |
| `gstin` | string \| null | Max 20 |
| `currency` | string | Max 8; the UI upper-cases it |
| `address` | object \| null | String values; the UI sends `line1`, `line2`, `city`, `state`, `pincode` |
| `profileImageKey` | string \| null | Must start with `<merchantId>/` |

At least one field is required; an empty object returns
`400 No changes supplied`.

```bash
curl -s -b /tmp/mushak.cookies -X PATCH \
  -H 'content-type: application/json' \
  -d '{
    "name":"Ganesh Kirana",
    "phone":"+919876543210",
    "currency":"INR",
    "address":{"line1":"12 Market Road","city":"Pune","state":"Maharashtra","pincode":"411001"}
  }' \
  http://localhost:8080/api/merchant/profile
```

Returns the same shape as the GET, with the updated merchant.

An image key from another shop returns
`400 The image key must stay inside the merchant's own storage prefix.`

## Dashboard

`GET /api/merchant/dashboard`

Returns the totals used by the Dashboard screen.

```json
{
  "merchant": { "id": "0c8a…", "name": "Ganesh Kirana", "currency": "INR" },
  "counts": {
    "products": 42,
    "activeProducts": 40,
    "categories": 6,
    "lowStock": 4
  },
  "value": {
    "cost": 18450.5,
    "retail": 24300,
    "currency": "INR"
  },
  "today": {
    "movements": 12,
    "inQty": 30,
    "outQty": 7.5
  },
  "lowStock": [
    {
      "id": "f93d…",
      "name": "Milk 1 litre",
      "unit": "litre",
      "stockQty": 2,
      "reorderLevel": 6
    }
  ],
  "recentMovements": [
    {
      "id": "m1…",
      "productId": "f93d…",
      "productName": "Milk 1 litre",
      "type": "sale",
      "quantity": -1,
      "unit": "litre",
      "note": "Counter sale",
      "createdAt": "2026-11-08T11:02:00.000Z"
    }
  ]
}
```

### Field notes

| Field | Meaning |
| --- | --- |
| `counts.products` | All catalogue rows, archived included. |
| `counts.activeProducts` | Rows with `isActive=true`. |
| `counts.categories` | Categories in the shop. |
| `counts.lowStock` | Active products with a positive reorder level and quantity at or below it. |
| `value.cost` | Sum of `stockQty × purchasePrice`. |
| `value.retail` | Sum of `stockQty × sellingPrice`. |
| `value.currency` | The shop currency label. |
| `today.movements` | Movements since the database's local midnight. |
| `today.inQty` | Sum of positive movements today. |
| `today.outQty` | Sum of the absolute value of negative movements today. |
| `lowStock` | Up to 8 rows, lowest quantity first. |
| `recentMovements` | Up to 8 rows, newest first. |

The Dashboard does not poll. Call the endpoint again to refresh.
