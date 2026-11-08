# Mushak documentation

Mushak is the inventory application in the Shree Ganesh ERP suite. It helps a
small shop keep one catalogue of products, track stock movements, organise
categories, and give counter staff limited access.

This documentation is written in Markdown so it can be read on GitHub today and
published with GitHub Pages, MkDocs, or any other Markdown site generator later.

## Start here

| I am… | Read |
| --- | --- |
| A shop owner or counter staff member | [User guide](user-guide/README.md) |
| Setting up a shop for the first time | [Quick start](user-guide/quick-start.md) |
| A platform administrator | [Admin guide](admin-guide/README.md) |
| Integrating with the API | [API reference](api/README.md) |
| Running or deploying the software | [Operations guide](operations/setup.md) |
| Looking for a field, role, or term | [Reference](reference/glossary.md) |

## Documentation map

### User guide

- [How Mushak organises your shop](user-guide/01-concepts.md)
- [Getting started](user-guide/02-getting-started.md)
- [Dashboard](user-guide/03-dashboard.md)
- [Catalogue](user-guide/04-catalogue.md)
- [Inventory](user-guide/05-inventory.md)
- [Product detail](user-guide/06-product-detail.md)
- [Stock movements](user-guide/07-stock-movements.md)
- [Categories](user-guide/08-categories.md)
- [Staff and permissions](user-guide/09-staff-and-permissions.md)
- [Settings](user-guide/10-settings.md)
- [Troubleshooting](user-guide/11-troubleshooting.md)

### Admin guide

- [Admin overview](admin-guide/README.md)
- [Managing merchants](admin-guide/merchants.md)
- [Managing users](admin-guide/users.md)

### API reference

- [API conventions](api/README.md)
- [Authentication](api/auth.md)
- [Health, OpenAPI and MCP](api/health-mcp.md)
- [Platform admin](api/platform-admin.md)
- [Merchant profile and dashboard](api/merchant-profile-dashboard.md)
- [Categories](api/categories.md)
- [Catalogue](api/catalogue.md)
- [Inventory](api/inventory.md)
- [Stock](api/stock.md)
- [Staff](api/staff.md)
- [Object storage](api/storage.md)
- [OpenAPI document](api/openapi.json)

### Reference

- [Permissions](reference/permissions.md)
- [Data model](reference/data-model.md)
- [Field rules](reference/fields.md)
- [Glossary](reference/glossary.md)

### Operations

- [Local setup](operations/setup.md)
- [Configuration](operations/configuration.md)
- [Object storage](operations/storage.md)
- [Mail](operations/mail.md)
- [Backups and upgrades](operations/backups-and-upgrades.md)
- [Operations troubleshooting](operations/troubleshooting.md)

## Conventions

- Screenshots use the light theme at a desktop width. The layout adapts to
  phones, and the theme toggle is available on every screen.
- Money examples use Indian rupees because `INR` is the default shop currency.
  The currency label itself comes from the shop profile.
- API examples assume the backend is at `http://localhost:8080` and use a saved
  session cookie. See [API conventions](api/README.md#curl-sessions).
- Dates and times are shown in the browser's local time zone.

## A note on versions

Mushak is at API version `0.1.0`. The documentation describes the code in this
repository. When a screen or endpoint changes, update the matching page in the
same change.
