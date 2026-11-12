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

`GET /api/merchant/dashboard?from=<epoch>&to=<epoch>`

Returns the shop snapshot and movement figures for a range. Both bounds are
Unix epoch **seconds** and inclusive. Omitting them uses today (local midnight
to now). The range must satisfy `to > from` and `to - from <= 366 days`; anything
else returns `400` with a clear message.

```bash
curl -s -b /tmp/mushak.cookies \
  "http://localhost:8080/api/merchant/dashboard?from=1794345600&to=1794432000"
```

```json
{
  "merchant": { "id": "0c8a…", "name": "Ganesh Kirana", "currency": "INR" },
  "range": { "from": 1794345600, "to": 1794432000 },
  "counts": {
    "products": 42,
    "activeProducts": 40,
    "categories": 6,
    "lowStock": 4
  },
  "value": {
    "cost": 18450.5,
    "retail": 24300,
    "margin": 5849.5,
    "currency": "INR"
  },
  "stockHealth": { "outOfStock": 1, "low": 4, "healthy": 35 },
  "categories": [
    { "id": "c1…", "name": "Dairy", "products": 6, "cost": 2100, "retail": 2800 }
  ],
  "topValue": [
    {
      "id": "f93d…",
      "name": "Basmati Rice 5 kg",
      "unit": "kg",
      "stockQty": 18,
      "cost": 8640,
      "retail": 10080
    }
  ],
  "lowStock": [
    {
      "id": "f93d…",
      "name": "Milk 1 litre",
      "unit": "litre",
      "stockQty": 2,
      "reorderLevel": 6
    }
  ],
  "period": {
    "from": 1794345600,
    "to": 1794432000,
    "movements": 12,
    "inQty": 30,
    "outQty": 7.5,
    "series": [
      { "date": "2026-11-08", "inQty": 10, "outQty": 2 },
      { "date": "2026-11-09", "inQty": 20, "outQty": 5.5 }
    ]
  },
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
| `value.margin` | `retail - cost`. |
| `value.currency` | The shop currency label. |
| `stockHealth` | Active products split into out-of-stock, low and healthy. |
| `categories` | Cost and retail value per category; uncategorised products appear with `id: null`. |
| `topValue` | Five active products with stock, ordered by retail value. |
| `period.movements` | Movements inside the range. |
| `period.inQty` | Sum of positive movements in range. |
| `period.outQty` | Sum of the absolute value of negative movements in range. |
| `period.series` | One point per local day, including days with no movements. |
| `lowStock` | Up to 8 rows, lowest quantity first. |
| `recentMovements` | Up to 8 rows, newest first. |

Stock counts and valuation are a current snapshot; only the `period` and
`recentMovements` fields depend on the range. The Dashboard does not poll. Call
the endpoint again to refresh.

## Shop report

`GET /api/merchant/report?from=<epoch>&to=<epoch>`

Returns the data behind the printable report. It uses the same epoch-second
range rules as the Dashboard, but defaults to the **last 30 days** when the
bounds are omitted.

```bash
curl -s -b /tmp/mushak.cookies \
  "http://localhost:8080/api/merchant/report?from=1791753600&to=1794432000"
```

The response repeats the snapshot fields above and adds:

| Field | Meaning |
| --- | --- |
| `generatedAt` | ISO timestamp when the report was built. |
| `generatedBy` | Name of the signed-in user. |
| `outOfStock` | Up to 200 active products with quantity `<= 0`. |
| `movements` | Up to 1,000 movements in range, newest first. |
| `movementTotal` | Total movements in range before the 1,000-row cap. |
| `truncated` | `true` when `movementTotal` is larger than `movements.length`. |

`lowStock` is capped at 200 rows for the report. Every shop role can call the
endpoint. Printing and PDF export happen in the browser; the API returns JSON
only. The CSV ZIP, XLSX and JSON downloads are also generated in the browser
from this response, so there is no separate export endpoint.
