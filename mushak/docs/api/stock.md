# Stock API

Stock endpoints append movements and update the cached on-hand quantity in one
database transaction. There is no endpoint that sets `stockQty` directly.

| Operation | Path | Permission |
| --- | --- | --- |
| Move stock | `POST /api/merchant/inventory/{id}/stock` | `stock` |
| Product history | `GET /api/merchant/inventory/{id}/movements` | `stock` |
| Shop history | `GET /api/merchant/movements` | `stock` |

`{id}` is the inventory row id.

## Movement types

| Type | Sign | Meaning |
| --- | --- | --- |
| `purchase` | `+` | Received from a supplier |
| `sale` | `-` | Sold |
| `return_in` | `+` | Customer returned goods |
| `return_out` | `-` | Returned to a supplier |
| `adjustment` | Chosen | Stock take or correction |
| `damage` | `-` | Breakage, expiry, loss |
| `transfer_in` | `+` | Received from another location |
| `transfer_out` | `-` | Sent to another location |

The request always sends a **positive** `quantity`. The type decides the sign;
`adjustment` also needs `direction`.

## Move stock

`POST /api/merchant/inventory/{id}/stock`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `type` | string | Yes | One of the movement types |
| `quantity` | number | Yes | Greater than 0, max 10,000,000 |
| `direction` | `"in"` \| `"out"` | For `adjustment` | Ignored for other types |
| `unitCost` | number \| null | No | 0 to 10,000,000; informational |
| `note` | string \| null | No | Max 280 characters |

```bash
curl -s -b /tmp/mushak.cookies \
  -H 'content-type: application/json' \
  -d '{"type":"sale","quantity":2,"note":"Counter sale"}' \
  http://localhost:8080/api/merchant/inventory/<inventoryId>/stock
```

Returns `200`:

```json
{
  "product": {
    "id": "f93d…",
    "merchantId": "0c8a…",
    "catalogueItemId": "b6f2…",
    "stockQty": 22,
    "reorderLevel": 10,
    "imageKey": null,
    "createdAt": "2026-11-01T08:00:00.000Z",
    "updatedAt": "2026-11-08T11:02:00.000Z",
    "name": "Basmati rice 5 kg",
    "unit": "kg"
  },
  "movement": {
    "id": "m1…",
    "merchantId": "0c8a…",
    "inventoryItemId": "f93d…",
    "type": "sale",
    "quantity": -2,
    "unitCost": null,
    "referenceType": null,
    "referenceId": null,
    "note": "Counter sale",
    "createdAt": "2026-11-08T11:02:00.000Z"
  }
}
```

`movement.quantity` is signed. `product.stockQty` is the new total.

### Rules

- The inventory row is locked `FOR UPDATE` for the transaction, so concurrent
  movements cannot lose an update.
- The resulting quantity cannot be below zero:
  `Only 4 pcs in stock, cannot remove 5` (`400`).
- Archived products cannot move:
  `This product is archived. Restore it before moving stock.` (`400`).
- A missing row returns `404`.
- `unitCost` is stored on the movement only. It does not update the product's
  purchase price.
- There is no idempotency key. A retried request records a second movement.

### Adjustment example

```json
{
  "type": "adjustment",
  "quantity": 3,
  "direction": "out",
  "note": "Stock take: three packs damaged"
}
```

`direction` is validated only for adjustments. Omitting it returns
`400 direction: Direction is required for an adjustment`.

## Product movement history

`GET /api/merchant/inventory/{id}/movements`

Returns the product plus its last 100 movements, newest first:

```json
{
  "product": { "id": "f93d…", "name": "Basmati rice 5 kg", "unit": "kg" },
  "movements": [
    {
      "id": "m1…",
      "merchantId": "0c8a…",
      "inventoryItemId": "f93d…",
      "type": "sale",
      "quantity": -2,
      "unitCost": null,
      "referenceType": null,
      "referenceId": null,
      "note": "Counter sale",
      "createdAt": "2026-11-08T11:02:00.000Z"
    }
  ]
}
```

The `product.id` here is the inventory row id. Unknown ids return `404`.

## Shop movement history

`GET /api/merchant/movements?limit=50`

Returns movements across the shop, newest first, joined with the product name
and unit:

```json
[
  {
    "id": "m1…",
    "productId": "f93d…",
    "productName": "Basmati rice 5 kg",
    "unit": "kg",
    "type": "sale",
    "quantity": -2,
    "unitCost": null,
    "note": "Counter sale",
    "createdAt": "2026-11-08T11:02:00.000Z"
  }
]
```

`limit` is clamped to 1–200; the default is 50. There is no offset, cursor or
date filter. For older rows, query the database or add a filter to the
endpoint.

## Permissions

| Caller | Move stock | Read history |
| --- | --- | --- |
| Merchant | Yes | Yes |
| Staff with `stock` | Yes | Yes |
| Staff without `stock` | `403` | `403` |

The frontend hides the Stock screen and the movement table without the
permission.

## Reference fields

`referenceType` and `referenceId` exist in the table for future links to
invoices, purchase orders or transfers. No endpoint sets them today, and they
are always `null` in responses.

## Corrections

Movements are append-only. To correct a mistake, post the opposite type:

```bash
# A sale was entered twice; put the extra quantity back.
curl -s -b /tmp/mushak.cookies -H 'content-type: application/json' \
  -d '{"type":"return_in","quantity":2,"note":"Correction: duplicate sale"}' \
  http://localhost:8080/api/merchant/inventory/<inventoryId>/stock
```

Do not update `stock_movements` or `inventory_items.stock_qty` by hand; doing so
breaks the audit trail.
