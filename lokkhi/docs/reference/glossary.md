# Glossary

**Archived in Mushak** — the invoice line points at a Mushak product that exists
but is inactive. Shown as a quiet hint; nothing is blocked.

**Catalogue item** — a product definition in Mushak: name, SKU, HSN, unit, tax
rate and prices. Stock lives in a separate inventory row.

**Draft** — an unnumbered, editable invoice. It has no stock effect.

**Financial year** — April to March, rendered as `2026-27`. Part of the invoice
number.

**Invoice kind** — `sale` or `purchase`. Determines labels, default price and the
stock movement direction.

**Issued** — a numbered, frozen invoice. It can be printed or voided.

**Line status** — derived from the Mushak link: `linked`, `missing` or
`archived`.

**Manual item** — an invoice line with no Mushak link. Fully supported, never an
error.

**Mushak** — the inventory application in the suite. Lokkhi suggests from it but
does not depend on it.

**Not in Mushak** — the line has no link, or the linked product was deleted.
Shown as a quiet hint with an **Add to Mushak** link.

**Snapshot** — the copy of the item details stored on the invoice line. Snapshots
are immutable once issued.

**Stock sync state** — per line: `not_applicable` (manual), `synced` (movement
written) or `failed` (issued without stock).

**Void** — cancels an issued invoice without deleting it. Numbers and stock
history are preserved.
