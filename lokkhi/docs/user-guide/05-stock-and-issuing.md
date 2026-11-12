# Issuing, stock and voiding

## Issuing

**Save & issue** writes the invoice and assigns its number. Issuing is the point
of no return for the document: lines, prices and tax are frozen.

Issuing always succeeds when the invoice itself is valid. Stock is a separate,
best-effort step.

## What happens to stock

For every line that is linked to a Mushak product, Lokkhi tries to record one
movement:

| Invoice kind | Movement | Effect |
| --- | --- | --- |
| Sale | `sale` | Stock goes down |
| Purchase | `purchase` | Stock goes up |

The movement is tagged with the invoice id and number, so Mushak history explains
where the stock change came from.

Manual lines are skipped. They have no Mushak product to move.

## When stock cannot be updated

Each line is attempted in its own savepoint. If one fails, only that line is
affected. The invoice is still issued, and the line shows:

> Stock not updated — <reason>

Common reasons:

- **Only 4 pcs in stock** — a sale needs more than Mushak has.
- **Item is archived in Mushak** — the product is no longer active.
- **Item has no stock row in Mushak** — the catalogue row exists but inventory
  data is incomplete.

A **Retry** link appears next to the note. Use it after you receive stock or
reactivate the product. Retry is safe: lines that already synced are skipped.

This is the same redundancy rule as the editor. A stock problem never invalidates
a sale.

## Voiding

An issued invoice can be **voided**, not deleted. Voiding:

- keeps the invoice number
- marks the invoice as void
- keeps every original stock movement in history
- adds a compensating movement for lines whose stock was applied

If a reversal cannot be written, the void still stands and the original history
remains intact. Lokkhi never edits or deletes stock history.

## Drafts

Drafts have no number and no stock effect. They can be edited or deleted freely.
Deleting a draft is permanent.
