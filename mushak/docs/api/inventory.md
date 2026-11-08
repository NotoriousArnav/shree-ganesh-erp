# Inventory API

Inventory rows hold **stock state**: on-hand quantity, reorder level and an
optional stock picture. Each inventory row belongs to exactly one catalogue
definition.

| Operation | Path | Permission |
| --- | --- | --- |
| List | `GET /api/merchant/inventory` | Any shop role |
| Create | `POST /api/merchant/inventory` | `catalogue` |
| Get one | `GET /api/merchant/inventory/{id}` | Any shop role |
| Update details | `PATCH /api/merchant/inventory/{id}` | `catalogue` |
| Archive | `DELETE /api/merchant/inventory/{id}` | `catalogue` |

The `{id}` is the **inventory row id**. Catalogue endpoints use the catalogue
item id; the product shape carries both.

## List inventory

`GET /api/merchant/inventory`

| Query | Type | Effect |
| --- | --- | --- |
| `q` | string | Name, SKU or barcode match |
| `categoryId` | UUID | One category |
| `lowStock` | `true` | Quantity at or below a positive reorder level |
| `includeInactive` | `true` | Include archived products |

Returns product shapes sorted by name, with `id` set to the inventory row id.
Rows include products at zero stock.

```bash
curl -s -b /tmp/mushak.cookies \
  'http://localhost:8080/api/merchant/inventory?lowStock=true'
```

## Get one inventory row

`GET /api/merchant/inventory/{id}`

Returns the product shape with the inventory id. Unknown or other-shop ids
return `404 Not found`.

## Create a product with stock

`POST /api/merchant/inventory`

Accepts the same definition fields as
[`POST /api/merchant/catalogue`](catalogue.md#create-a-catalogue-item), plus:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `stockQty` | number | No | 0 or more, default 0 |
| `reorderLevel` | number | No | 0 or more, default 0 |
| `inventoryImageKey` | string \| null | No | Must be under `<merchantId>/` |

```bash
curl -s -b /tmp/mushak.cookies \
  -H 'content-type: application/json' \
  -d '{
    "name":"Milk 1 litre",
    "categoryName":"Dairy",
    "unit":"litre",
    "purchasePrice":48,
    "sellingPrice":60,
    "stockQty":24,
    "reorderLevel":6
  }' \
  http://localhost:8080/api/merchant/inventory
```

Returns `201` with the product shape, including `id` (inventory row) and
`catalogueItemId`.

### Opening stock

A non-zero `stockQty` is written as a stock movement of type `adjustment` with
the note `Opening stock`, inside the same transaction. Because that is a stock
change, it requires the `stock` permission as well as `catalogue`:

```json
{ "error": "You do not have permission to add opening stock." }
```

`403`. A user with only `catalogue` can still create the product with
`stockQty: 0`.

### Image

`inventoryImageKey` is the stock row's own picture. It is separate from the
catalogue `imageKey`. The UI shows the inventory picture first and falls back
to the catalogue picture.

## Update inventory details

`PATCH /api/merchant/inventory/{id}`

Accepts definition fields (`name`, prices, GST, SKU, barcode, unit, category),
plus `reorderLevel` and `inventoryImageKey`.

```json
{
  "reorderLevel": 12,
  "sellingPrice": 62,
  "inventoryImageKey": null
}
```

Returns the updated product shape. `stockQty` is **not** accepted; stock changes
use the [stock endpoint](stock.md). Sending no recognised change returns
`400 No changes supplied`.

The UI does not currently show an edit action on the Inventory list, but the
endpoint is supported and the product detail page uses the equivalent update.

## Archive an inventory row

`DELETE /api/merchant/inventory/{id}`

Archives the catalogue item behind the row. Returns:

```json
{ "id": "f93d…", "isActive": false }
```

Stock and movements are kept. Restore with
`PATCH /api/merchant/catalogue/{catalogueItemId}` and `{"isActive":true}`; the
inventory endpoint's update shape also accepts `isActive`.

## Errors

| Status | Meaning |
| --- | --- |
| `400` | Validation failed, bad image key, or no changes |
| `403` | Missing `catalogue`, or opening stock without `stock` |
| `404` | Inventory row not found in this shop |
| `409` | Duplicate SKU or barcode |

## Catalogue versus inventory

| You want to… | Use |
| --- | --- |
| Create a definition with no stock | Catalogue |
| Create a definition with opening stock | Inventory |
| Change price, GST, name, SKU | Either; both update the definition |
| Change the stock picture | Inventory |
| Change the reorder level | Either |
| Change on-hand quantity | Stock endpoint only |
| Archive or restore | Either; both act on the definition |
