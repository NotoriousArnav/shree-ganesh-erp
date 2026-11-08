# Field rules

This page collects the validation and formatting rules that apply across the
UI and the API.

## Identifiers

| Field | Format |
| --- | --- |
| Shop, category, product, stock, movement ids | UUID |
| User and session ids | Opaque Better Auth strings |
| Product `id` on catalogue endpoints | Catalogue item UUID |
| Product `id` on inventory endpoints | Inventory row UUID |
| `catalogueItemId` | Always the definition UUID |

## Units

Exactly these values:

```
pcs  kg  g  litre  ml  box  packet  dozen  bundle  metre  sqft
```

- Default: `pcs`.
- The unit is stored on the catalogue item, not on the movement.
- Changing the unit relabels existing movements; it does not convert them.
- Quantities accept up to three decimal places, so `0.250 kg` is valid.

## Money

| Field | Range | Decimals |
| --- | --- | --- |
| `purchasePrice` | 0 to 10,000,000 | 2 |
| `sellingPrice` | 0 to 10,000,000 | 2 |
| `unitCost` on a movement | 0 to 10,000,000 | 2 |
| `taxRate` | 0 to 100 | 2 |

Money is a number in JSON, not a string. Negative prices are rejected. The shop
`currency` is a label only; changing it does not convert values.

## Quantities

| Field | Range | Decimals |
| --- | --- | --- |
| `stockQty` | 0 to 10,000,000 | 3 |
| `reorderLevel` | 0 to 10,000,000 | 3 |
| `quantity` on a movement | > 0 to 10,000,000 | 3 |

The movement `quantity` is positive in the request and signed in storage and
responses. A resulting stock below zero is rejected.

## SKU

- Optional; generated when blank.
- Maximum 64 characters when supplied.
- Unique per shop, case-sensitive in the database.
- Generated form: upper-case words joined by `-`, letters and Indic marks kept,
  digits kept, limited to 24 characters.
- Collisions get `-2`, `-3`, … up to `-999`, then a base-36 timestamp suffix.

## Barcode

- Optional; blank becomes `null`.
- Maximum 64 characters.
- Unique per shop when present.
- Not used to generate SKUs.

## HSN code

- Optional; maximum 16 characters.
- Free text, stored for reference.
- Not validated against an HSN catalogue.

## GST rate

- Percentage from 0 to 100.
- Default 0.
- Stored per product, not per shop.
- Mushak does not compute tax returns or split CGST/SGST.

## Name fields

| Field | Maximum | Notes |
| --- | --- | --- |
| Shop name | 120 | Required; trimmed |
| Staff or user name | 120 | Required; trimmed |
| Product name | 160 | Required; trimmed |
| Category name | 80 | Required; trimmed |

## Email

- Required for every account.
- Trimmed and lowercased before saving.
- Must be a valid email address; maximum 160 characters.
- Unique across the platform.

## Phone

- Optional for users and shops.
- Maximum 24 characters on shop and user records.
- Staff creation requires 7 to 15 digits with an optional leading `+`.
- Ten digits are stored as `+91XXXXXXXXXX`.
- Unique across the platform when present.
- Enables phone sign-in; SMS OTP is not configured.

## Password

| Rule | Value |
| --- | --- |
| Minimum | 8 characters |
| Maximum | 128 characters |
| Hashing | Better Auth credential account |
| Reset | Single-use emailed token, or owner-set for staff |

## Slug

- Used by shops.
- Lowercase letters, numbers and single dashes: `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Maximum 60 characters.
- Unique across the platform.
- Generated from the shop name when omitted.

## Currency

- Maximum 8 characters.
- Default `INR`.
- Displayed as typed by the API; the Settings screen upper-cases it.
- Not validated against ISO 4217, and not converted.

## Address

- JSON object with string values.
- The UI writes `line1`, `line2`, `city`, `state`, `pincode`.
- Any other string keys are accepted and preserved.
- The whole object can be `null` to clear the address.
- PIN code is not validated against a postal database.

## Image key

- Object-storage key, maximum 1024 characters.
- Must start with `<merchantId>/`.
- Must not contain `..` or a null byte.
- Generated upload keys look like
  `<merchantId>/<folder>/<YYYY-MM>/<uuid>-<filename>`.
- The folder is optional; `products`, `profile` and similar are conventions, not
  requirements.
- `null` clears the picture.

## Notes

- Movement notes: maximum 280 characters.
- Leading and trailing whitespace is trimmed.
- An empty note becomes `null`.

## Free-form attributes

- `attributes` is a JSON object of string values.
- Stored on the catalogue item for vertical-specific fields such as brand,
  author, size or colour.
- The UI does not edit it yet; it is available through the API.

## Timestamps

- Stored as `timestamptz`.
- Returned as ISO 8601 strings.
- Created and updated automatically.
- Movements have only `createdAt`.
- Dashboard “today” uses the database server's local midnight.

## Pagination and limits

| Endpoint | Limit |
| --- | --- |
| Catalogue list | No pagination; all matching rows |
| Inventory list | No pagination; all matching rows |
| Categories list | No pagination |
| Staff list | No pagination |
| Product movements | Last 100 |
| Shop movements | `limit` 1–200, default 50 |
| Storage list | `limit` 1–1000, default 100 |
| Direct upload | 25 MB body |

## Request size and encoding

- JSON bodies use UTF-8.
- Names may contain any script, including Indic scripts.
- Search is case-insensitive through SQL `ILIKE`.
- Empty strings in optional text fields are converted to `null` on write.
