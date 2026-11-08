# Catalogue API

Catalogue endpoints manage product **definitions**: name, code, unit, tax and
prices. Creating a product also creates its inventory row, but stock quantity is
only changed through the [stock endpoint](stock.md).

| Operation | Path | Permission |
| --- | --- | --- |
| List | `GET /api/merchant/catalogue` | Any shop role |
| Create | `POST /api/merchant/catalogue` | `catalogue` |
| Get one | `GET /api/merchant/catalogue/{id}` | Any shop role |
| Update | `PATCH /api/merchant/catalogue/{id}` | `catalogue` |
| Archive | `DELETE /api/merchant/catalogue/{id}` | `catalogue` |

The `{id}` is the **catalogue item id**, not the inventory row id.

## List catalogue items

`GET /api/merchant/catalogue`

| Query | Type | Effect |
| --- | --- | --- |
| `q` | string | Case-insensitive match on name, SKU or barcode |
| `categoryId` | UUID | Only that category |
| `includeInactive` | `true` | Include archived products |

Returns an array of [product shapes](README.md#the-product-shape), sorted by
name.

```bash
curl -s -b /tmp/mushak.cookies \
  'http://localhost:8080/api/merchant/catalogue?q=rice&categoryId=a11e…'
```

Products added here start with an inventory row at `stockQty: 0`.

## Get one catalogue item

`GET /api/merchant/catalogue/{id}`

Returns the same shape as a list item. A catalogue id from another shop returns
`404 Not found`.

## Create a catalogue item

`POST /api/merchant/catalogue`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | Yes | 1 to 160 characters |
| `categoryId` | UUID \| null | No | Must belong to the shop |
| `categoryName` | string \| null | No | Reuses an existing name; creates one only with `categories` |
| `sku` | string \| null | No | Max 64; generated when blank |
| `barcode` | string \| null | No | Max 64; unique when present |
| `unit` | string | No | Enum, default `pcs` |
| `hsnCode` | string \| null | No | Max 16 |
| `taxRate` | number | No | 0 to 100, default 0 |
| `purchasePrice` | number | No | 0 to 10,000,000, default 0 |
| `sellingPrice` | number | No | 0 to 10,000,000, default 0 |
| `attributes` | object \| null | No | String values |
| `imageKey` | string \| null | No | Must be under `<merchantId>/` |

```bash
curl -s -b /tmp/mushak.cookies \
  -H 'content-type: application/json' \
  -d '{
    "name":"Basmati rice 5 kg",
    "categoryName":"Grains",
    "unit":"kg",
    "taxRate":5,
    "purchasePrice":95,
    "sellingPrice":120
  }' \
  http://localhost:8080/api/merchant/catalogue
```

Returns `201` with the product shape, including the new `inventoryItemId` and
`stockQty: 0`.

### Category handling

- `categoryName` wins over `categoryId` when both are sent.
- An existing name is reused even without the `categories` permission.
- A new name creates a category only with the permission; otherwise `403`.
- Sending `categoryName: null` clears the category.

### Generated SKU

When `sku` is blank, Mushak builds one from the name. Letters in any script are
kept, words are joined with `-`, the result is upper-cased and limited to 24
characters. A collision adds `-2`, `-3` and so on.

### Errors

| Status | Meaning |
| --- | --- |
| `400` | Validation failed, bad image key, or category not found |
| `403` | Missing `catalogue`, or missing `categories` for a new inline category |
| `409` | Duplicate SKU or barcode |

## Update a catalogue item

`PATCH /api/merchant/catalogue/{id}`

Accepts any subset of the create fields, plus:

| Field | Type | Effect |
| --- | --- | --- |
| `isActive` | boolean | `false` archives, `true` restores |
| `reorderLevel` | number | Updates the linked inventory row in the same transaction |
| `imageKey` | string \| null | Replaces or clears the product picture |

At least one change is required;
`400 No changes supplied` otherwise.

```json
{
  "sellingPrice": 125,
  "reorderLevel": 12,
  "categoryName": "Grains"
}
```

Returns the updated product shape.

**Stock quantity cannot be set here.** `stockQty` is ignored because it is not
part of the accepted shape. Use `POST /api/merchant/inventory/{inventoryId}/stock`.

`unit` can be changed even after stock exists. Existing movements keep their
numeric quantity and follow the new unit label, so change it only when the
physical unit is genuinely the same.

## Archive a catalogue item

`DELETE /api/merchant/catalogue/{id}`

Soft delete. Returns:

```json
{ "id": "b6f2…", "isActive": false }
```

The inventory row and movements are kept. Archived products:

- are hidden from lists unless `includeInactive=true`;
- cannot receive stock movements;
- are not counted as active on the dashboard.

Restore with:

```bash
curl -s -b /tmp/mushak.cookies -X PATCH \
  -H 'content-type: application/json' \
  -d '{"isActive":true}' \
  http://localhost:8080/api/merchant/catalogue/<id>
```

There is no hard-delete endpoint.

## Permissions and visibility

| Action | Merchant | Staff `catalogue` | Staff without it |
| --- | --- | --- | --- |
| List / get | Yes | Yes | Yes |
| Create / update / archive | Yes | Yes | `403` |
| Inline new category | Yes | Only with `categories` | Only reuse existing |

## Worked example: create then stock

```bash
# 1. Create the definition.
curl -s -b /tmp/mushak.cookies -H 'content-type: application/json' \
  -d '{"name":"Milk 1 litre","unit":"litre","sellingPrice":60}' \
  http://localhost:8080/api/merchant/catalogue

# 2. Read inventoryItemId from the response, then add stock.
curl -s -b /tmp/mushak.cookies -H 'content-type: application/json' \
  -d '{"type":"purchase","quantity":24,"unitCost":48}' \
  http://localhost:8080/api/merchant/inventory/<inventoryItemId>/stock
```
