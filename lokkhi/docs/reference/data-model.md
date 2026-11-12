# Data model

Lokkhi adds three tables to the shared suite database. They live in
`packages/db/src/schema.ts` next to the Mushak tables, so both apps share one
migration history.

## `invoices`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `merchant_id` | uuid | Tenant scope, cascade delete |
| `kind` | `invoice_kind` | `sale` or `purchase` |
| `status` | `invoice_status` | `draft`, `issued`, `void` |
| `number` | text | Null while draft, unique per merchant |
| `financial_year` | text | Set on issue, e.g. `2026-27` |
| `invoice_date` | date | Drives the financial year |
| `due_date` | date | Optional |
| `party_name` | text | Required snapshot |
| `party_phone` | text | Optional |
| `party_gstin` | text | Optional |
| `party_address` | jsonb | Optional |
| `currency` | text | Defaults to `INR` |
| `notes` | text | Printed |
| `subtotal` | numeric(12,2) | Sum of gross line subtotals |
| `discount_total` | numeric(12,2) | Sum of line discounts |
| `tax_total` | numeric(12,2) | Sum of line tax |
| `total` | numeric(12,2) | `subtotal − discount + tax` |
| `issued_at` | timestamptz | Set on issue |
| `voided_at` | timestamptz | Set on void |
| `created_by` | text | `users.id`, set null on delete |

Indexes: merchant + date, merchant + status, unique merchant + number.

## `invoice_lines`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `merchant_id` | uuid | Tenant scope |
| `invoice_id` | uuid | Cascade delete |
| `position` | integer | Display order |
| `catalogue_item_id` | uuid | **Nullable**, `ON DELETE SET NULL` |
| `item_name` | text | Snapshot, not null |
| `sku`, `hsn_code` | text | Snapshot |
| `unit` | text | Snapshot, defaults to `pcs` |
| `quantity` | numeric(14,3) | |
| `unit_price` | numeric(12,2) | |
| `discount` | numeric(12,2) | Absolute amount |
| `tax_rate` | numeric(5,2) | One combined rate |
| `line_subtotal` | numeric(12,2) | qty × price |
| `line_taxable` | numeric(12,2) | subtotal − discount |
| `line_tax` | numeric(12,2) | taxable × rate |
| `line_total` | numeric(12,2) | taxable + tax |
| `stock_movement_id` | uuid | `stock_movements.id`, set null |
| `stock_sync_state` | enum | `not_applicable`, `synced`, `failed` |
| `stock_sync_note` | text | Human-readable failure reason |

The nullable `catalogue_item_id` is the redundancy rule in the schema. Snapshot
columns are `NOT NULL`.

## `invoice_sequences`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `merchant_id` | uuid | Tenant scope |
| `kind` | `invoice_kind` | Separate counters for sales and purchases |
| `financial_year` | text | e.g. `2026-27` |
| `next_number` | integer | Starts at 1 |

Unique on merchant + kind + financial year. The row is locked with
`SELECT … FOR UPDATE` inside the issue transaction, so two simultaneous issues
cannot take the same number.

## Relationship to Mushak

```text
merchants ─┬─ catalogue_items ── inventory_items ── stock_movements
           │        │                                   ▲
           │        └──── invoice_lines.catalogue_item_id│
           └──── invoices ──── invoice_lines.stock_movement_id
```

`stock_movements.reference_type` is `invoice` (or `invoice_void`) and
`reference_id` is the invoice id, which is what the field was reserved for.
