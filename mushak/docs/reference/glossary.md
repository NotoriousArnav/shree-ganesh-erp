# Glossary

## A

**Account** — A row in Better Auth's `accounts` table holding the credential
(or future provider) for a user. A staff member with a password has one
credential account.

**Adjustment** — A stock movement whose direction you choose. Used for stock
takes, corrections and opening stock.

**Admin area** — `/admin`, available to `super_admin` and `dev`. Lists shops and
users and creates shop owners.

**Archive** — Soft delete for a product. Sets `is_active=false`, hides the
product from lists, keeps its stock and history. Restore with `is_active=true`.

**Audit trail** — The append-only `stock_movements` table. Every quantity change
is a row.

## C

**Catalogue item** — The product definition: name, SKU, barcode, unit, HSN, GST
and prices. One per product.

**Category** — A shop-scoped group for products. Names are unique within a shop.
Deleting a category uncategorises its products.

**Console mailer** — The development mail transport. Prints messages to the
terminal and writes `.eml`/`.json` files under `MAIL_DIR`.

**SMTP mailer** — The production mail transport. Delivers through any SMTP
server configured with `SMTP_HOST` and the related variables.

**Currency** — A display label on the shop, default `INR`. Not converted.

## D

**Dashboard** — The first shop screen. Shows counts, stock value, today's
movements and low-stock products.

**Deactivation** — Banning an account. It cannot sign in and its sessions are
deleted.

**Definition** — See *catalogue item*.

## I

**Inventory item** — The stock row linked one-to-one to a catalogue item. Holds
`stockQty`, `reorderLevel` and an optional picture.

**Inventory tab** — The screen focused on quantities and stock actions.

## L

**Low stock** — A product whose reorder level is above zero and whose quantity
is at or below it. Level `0` disables the warning.

## M

**Merchant** — A shop, and the role of its owner. A merchant account always has
every shop permission.

**Movement** — See *stock movement*.

**MCP** — Model Context Protocol. Mushak exposes a minimal `/mcp` endpoint with
a `health_check` tool.

## O

**Object key** — The storage path for an image, always under
`<merchantId>/`. The key is saved on the product or shop row; the bytes live in
S3-compatible storage.

**Opening stock** — The quantity entered when adding a product on Inventory. It
is recorded as an adjustment with the note `Opening stock`.

## P

**Permission** — One of `stock`, `catalogue`, `categories`. Merchants have all
three; staff have the ticked subset.

**Platform role** — `super_admin` or `dev`. Sees every shop through `/admin` and
`/api/admin`, but cannot use the shop API.

**Presigned URL** — A time-limited signed URL that lets a browser upload to or
download from object storage without sharing credentials.

**Product shape** — The JSON object returned by catalogue and inventory
endpoints. It joins the definition, its stock row and the category name.

**PWA** — Progressive Web App. Mushak can be installed to a phone's home screen;
data still comes from the server.

## R

**Reorder level** — The low-stock threshold stored on the inventory row. See
*low stock*.

**Role** — `super_admin`, `dev`, `merchant` or `staff`. Constrained in the
database.

## S

**Session** — A database-backed sign-in lasting up to 30 days. Sent as the
`better-auth.session_token` cookie.

**Settings** — The shop profile screen, owner-only.

**SKU** — Stock keeping unit. A shop-unique code, generated from the name when
blank.

**Staff** — A shop account limited by permissions. Cannot open Staff or
Settings.

**Stock movement** — One signed quantity change with a type, optional unit cost,
optional note and a timestamp. Append-only.

**Stock value** — `on hand × price`, summed across the shop. The Dashboard shows
cost and retail.

## T

**Tenant** — One shop's data boundary. Everything is scoped by `merchantId`.

**Trusted origin** — A frontend origin allowed to call the auth API and upload to
the bucket. Configured with `FRONTEND_URL`, `BETTER_AUTH_URL` and
`TRUSTED_ORIGINS`. Development accepts every origin; production enforces the
list unless `TRUSTED_ORIGINS=*`.

## U

**Unit** — The fixed measure for a product: `pcs`, `kg`, `litre` and so on.

## V

**View-only** — A staff account with no permissions ticked. It can read the
Dashboard, Inventory and Catalogue but change nothing.
