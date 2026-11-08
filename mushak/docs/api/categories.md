# Categories API

Categories are shop-scoped product groups. Names are unique per shop.

| Operation | Path | Permission |
| --- | --- | --- |
| List | `GET /api/merchant/categories` | Any shop role |
| Create | `POST /api/merchant/categories` | `categories` |
| Rename / re-parent | `PATCH /api/merchant/categories/{id}` | `categories` |
| Delete | `DELETE /api/merchant/categories/{id}` | `categories` |

A merchant always passes the permission check. A staff account needs the
`categories` permission.

## List categories

`GET /api/merchant/categories`

Returns categories alphabetically with a product count:

```json
[
  {
    "id": "a11e…",
    "name": "Dairy",
    "parentId": null,
    "productCount": 6
  }
]
```

`productCount` counts catalogue rows in the category, archived included. It is
computed with a left join, so a category with no products returns `0`.

```bash
curl -s -b /tmp/mushak.cookies \
  http://localhost:8080/api/merchant/categories
```

## Create a category

`POST /api/merchant/categories`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | Yes | 1 to 80 characters after trimming |
| `parentId` | UUID \| null | No | Must belong to the same shop |

```json
{ "name": "Dairy" }
```

Returns `201` with the full category row (`id`, `merchantId`, `parentId`,
`name`, `createdAt`, `updatedAt`).

| Status | Meaning |
| --- | --- |
| `201` | Created |
| `400` | Invalid name, or parent not found |
| `403` | Missing `categories` permission |
| `409` | A category with that name already exists |

Names are compared case-insensitively when products reference them, but the
unique index is case-sensitive on the stored value. Prefer consistent casing.

## Rename or re-parent

`PATCH /api/merchant/categories/{id}`

Accepts a partial body with `name` and/or `parentId`. `parentId: null` removes
the parent.

```json
{ "name": "Packaged food" }
```

Returns the updated row. A category cannot be its own parent; that returns
`400 A category cannot be its own parent`. An unknown parent returns
`400 Parent category not found`.

## Delete a category

`DELETE /api/merchant/categories/{id}`

```json
{ "id": "a11e…" }
```

Returns `200`. The delete is permanent:

- products in the category keep existing and become uncategorised;
- child categories keep existing with `parentId` set to `null`;
- no stock or movement rows are touched.

An unknown or other-shop id returns `404 Not found`.

## Inline creation through a product

The catalogue and inventory create/update endpoints also accept `categoryName`.
If a category with that name exists, it is reused. If it does not:

- a caller with `categories` creates it as a side effect;
- a caller without the permission gets
  `403 That category does not exist and you do not have permission to create one.`

Sending an empty `categoryName` clears the category.

## Parent hierarchy

The API stores a parent link and validates that it belongs to the shop. The UI
currently creates flat categories. A product is assigned to exactly one
category; there is no inherited roll-up of products through parents.

## Errors

| Status | Body |
| --- | --- |
| `400` | `{ "error": "name: Name is required" }` |
| `400` | `{ "error": "Parent category not found" }` |
| `403` | `{ "error": "You do not have permission to change categories." }` |
| `404` | `{ "error": "Not found" }` |
| `409` | `{ "error": "A category with that name already exists" }` |
