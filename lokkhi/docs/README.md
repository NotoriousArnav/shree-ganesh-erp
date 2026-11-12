# Lokkhi documentation

Lokkhi is the invoicing application in the Shree Ganesh ERP suite. It creates
sales invoices and purchase invoices, prints them, and optionally links lines to
Mushak catalogue items.

Lokkhi is **not** a validation layer for Mushak. An item that is not in Mushak
can still be sold, billed and issued. Mushak suggestions are a convenience, not a
requirement.

## Start here

| I am… | Read |
| --- | --- |
| A shop owner or counter staff member | [User guide](user-guide/README.md) |
| Setting Lokkhi up next to Mushak | [Setup](operations/setup.md) |
| Integrating with the API | [API reference](api/README.md) |
| Looking for a field or a term | [Reference](reference/glossary.md) |

## The one rule

Invoice lines are **self-contained snapshots**. Each line stores its own item
name, unit, quantity, price and tax rate, plus an optional `catalogueItemId`.

That means:

- No Mushak match → the line is saved as a manual item. Nothing complains.
- Mushak lookup fails → the editor says suggestions are unavailable. You can
  still type the item and finish the invoice.
- A Mushak product is edited later → the old invoice keeps its original name,
  price and tax.
- A Mushak product is deleted later → the line keeps its snapshot and is shown
  as `Not in Mushak`.
- Issuing an invoice never fails because of a missing or archived product.

## Documentation map

### User guide

- [How Lokkhi organises invoices](user-guide/01-concepts.md)
- [Creating an invoice](user-guide/02-creating-an-invoice.md)
- [Mushak suggestions](user-guide/03-mushak-suggestions.md)
- [Hints and Add to Mushak](user-guide/04-hints-and-adding-to-mushak.md)
- [Issuing, stock and voiding](user-guide/05-stock-and-issuing.md)
- [Printing](user-guide/06-printing.md)

### API

- [API overview](api/README.md)
- [Invoices](api/invoices.md)
- [OpenAPI document](api/openapi.json)

### Reference

- [Data model](reference/data-model.md)
- [Glossary](reference/glossary.md)

### Operations

- [Setup and deployment](operations/setup.md)
