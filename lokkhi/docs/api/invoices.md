# Invoices API

## Create a draft

```http
POST /api/merchant/invoices
Content-Type: application/json
```

```json
{
  "kind": "sale",
  "invoiceDate": "2026-11-12",
  "partyName": "Walk-in customer",
  "partyPhone": "9876543210",
  "notes": "Paid by UPI",
  "lines": [
    {
      "itemName": "Emergency bulb 9W",
      "unit": "pcs",
      "quantity": 2,
      "unitPrice": 150,
      "discount": 0,
      "taxRate": 18
    },
    {
      "catalogueItemId": "0b0e9c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
      "itemName": "Parle-G 100 g",
      "unit": "pcs",
      "quantity": 3,
      "unitPrice": 12,
      "discount": 0,
      "taxRate": 18
    }
  ]
}
```

The first line is a manual item: no `catalogueItemId`, no complaint. The second
is linked to Mushak and copies its snapshot from the request.

Response `201`:

```json
{
  "id": "9f0d2f7e-...",
  "kind": "sale",
  "status": "draft",
  "number": null,
  "total": 396.48,
  "lines": [
    {
      "itemName": "Emergency bulb 9W",
      "lineStatus": "missing",
      "stockSyncState": "not_applicable"
    },
    {
      "itemName": "Parle-G 100 g",
      "lineStatus": "linked",
      "stockSyncState": "not_applicable"
    }
  ]
}
```

`lineStatus` is derived, not stored. It is one of `linked`, `missing` or
`archived`.

## Update a draft

```http
PATCH /api/merchant/invoices/:id
```

Accepts the same fields as create. Supplying `lines` replaces all lines. Omitting
a field leaves it unchanged. Issued and void invoices return `409`.

## Issue

```http
POST /api/merchant/invoices/:id/issue
```

```json
{
  "id": "9f0d2f7e-...",
  "status": "issued",
  "number": "SALE/2026-27/0001",
  "financialYear": "2026-27",
  "lines": [
    { "itemName": "Parle-G 100 g", "stockSyncState": "synced" },
    {
      "itemName": "Emergency bulb 9W",
      "stockSyncState": "not_applicable"
    }
  ]
}
```

A linked sale whose stock is insufficient still issues:

```json
{
  "status": "issued",
  "lines": [
    {
      "itemName": "Parle-G 100 g",
      "stockSyncState": "failed",
      "stockSyncNote": "Only 4 pcs in stock, nothing was deducted"
    }
  ]
}
```

The HTTP status is `200`. Stock is advisory, the document is not.

Issuing an empty invoice returns `409`:

```json
{ "error": "Add at least one item before issuing this invoice" }
```

## Void

```http
POST /api/merchant/invoices/:id/void
```

Returns the invoice with `"status": "void"`. Original stock movements remain;
compensating movements are added best-effort.

## Retry stock

```http
POST /api/merchant/invoices/:id/lines/:lineId/retry-stock
```

Idempotent. Already-synced lines are skipped. Only `issued` invoices qualify.

## Add to Mushak

```http
POST /api/merchant/invoices/:id/lines/:lineId/add-to-mushak
Content-Type: application/json

{
  "name": "Emergency bulb 9W",
  "sku": null,
  "unit": "pcs",
  "hsnCode": "8539",
  "taxRate": 18,
  "price": 150
}
```

```json
{
  "catalogueItem": { "id": "...", "name": "Emergency bulb 9W" },
  "invoice": { "id": "...", "lines": [{ "lineStatus": "linked" }] }
}
```

Returns `409` when the line is already linked or the SKU is taken. The invoice
snapshot is never rewritten.

## Suggestions

```http
GET /api/merchant/invoices/suggestions?q=parle
```

```json
[
  {
    "id": "...",
    "name": "Parle-G 100 g",
    "sku": "PARLE-G-100G",
    "hsnCode": "1905",
    "unit": "pcs",
    "taxRate": 18,
    "purchasePrice": 8,
    "sellingPrice": 12,
    "stockQty": 50
  }
]
```

Returns up to ten active items. An empty `q` returns `[]`. A failure here has no
effect on invoice creation.
