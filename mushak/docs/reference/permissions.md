# Permissions

Mushak has four roles. Shop roles are limited to one shop; platform roles can
see every shop through the admin API and screen but cannot use the shop
endpoints.

## Roles

| Role | Scope | Summary |
| --- | --- | --- |
| `merchant` | One shop | The owner. Every shop permission, plus Staff and Settings. |
| `staff` | One shop | Views products and the dashboard. Changes are limited by three permissions. |
| `super_admin` | Platform | Full admin area. |
| `dev` | Platform | The same admin screens, intended for support. |

A merchant always has `stock`, `catalogue` and `categories`, regardless of the
stored permission array. Staff permissions are stored per account and
normalised to the known values.

## Staff permissions

| Permission | UI label | Allows |
| --- | --- | --- |
| `stock` | Move stock | Record movements; open the Stock screen; read movement history. |
| `catalogue` | Manage catalogue | Add, edit and archive products; upload images; set opening stock when adding. |
| `categories` | Manage categories | Create, rename and delete categories, including inline from the product form. |

Ticking nothing gives **view-only** access. Reading the Dashboard, Inventory and
Catalogue is always allowed.

## Action matrix

| Action | Merchant | Staff `stock` | Staff `catalogue` | Staff `categories` | Platform roles |
| --- | --- | --- | --- | --- | --- |
| Open Dashboard | Yes | Yes | Yes | Yes | No |
| View Inventory / Catalogue | Yes | Yes | Yes | Yes | No |
| Open product detail | Yes | Yes | Yes | Yes | No |
| Add product | Yes | No | Yes | No | No |
| Edit product definition | Yes | No | Yes | No | No |
| Archive / restore product | Yes | No | Yes | No | No |
| Record a stock movement | Yes | Yes | No | No | No |
| Set opening stock | Yes | No | Only with `stock` | No | No |
| Open Stock history | Yes | Yes | No | No | No |
| Open Categories screen | Yes | No | No | Yes | No |
| Add / rename / delete category | Yes | No | No | Yes | No |
| Reuse a category inline | Yes | No | Yes | Yes | No |
| Create a new category inline | Yes | No | No | Yes | No |
| Upload or delete an image | Yes | No | Yes | No | No |
| Read / download an image | Yes | Yes | Yes | Yes | No |
| Open Staff screen | Yes | No | No | No | No |
| Create / edit / deactivate staff | Yes | No | No | No | No |
| Reset a staff password | Yes | No | No | No | No |
| Open Settings | Yes | No | No | No | No |
| Change shop profile | Yes | No | No | No | No |
| List merchants / users | No | No | No | No | Yes |
| Create / edit merchant | No | No | No | No | Yes |
| Create a shop owner | No | No | No | No | Yes |

“Only with `stock`” means the account needs both `catalogue` to add the product
and `stock` to record the opening quantity. Without `stock`, the product is
created at zero.

## Visibility of screens

The sidebar shows:

| Screen | Shown when |
| --- | --- |
| Dashboard | Always |
| Inventory | Always |
| Catalogue | Always |
| Stock | `stock` |
| Categories | `categories` |
| Staff | role is `merchant` |
| Settings | role is `merchant` |

Hiding a screen is cosmetic. The API enforces the same rules, so opening a
hidden address directly still fails or shows a read-only view.

## Platform versus shop

- `/api/admin/*` requires `super_admin` or `dev`.
- `/api/merchant/*` requires a shop role linked to a shop.
- A platform account calling a shop endpoint gets `403 Forbidden`.
- A shop account calling an admin endpoint gets `403 Not a platform role`.
- Shop ids are taken from the session, never from request data.

## Enforcement points

| Layer | What it enforces |
| --- | --- |
| React router | Role guard for `/app` and `/admin` |
| Sidebar | Hides screens by role and permission |
| Buttons and dialogs | Hide actions by permission |
| Fastify pre-handler | The authoritative check for the API |
| Database | Role check constraint, unique indexes, foreign keys |

The client checks are for usability. The server check is the security boundary.

## Changing permissions

The shop owner edits a staff account in **Staff → Edit**. The change applies to
the next request; the staff user may need to reload the page to refresh the
sidebar.

Platform administrators do not manage staff permissions. They create owners,
which always have full shop access.

## Special cases

- A deactivated (`banned`) account gets `403` even with valid permissions.
- A shop account with no `merchant_id` gets `403 Account is not linked to a
  merchant`.
- An account whose shop was deleted cascades with the shop and can no longer
  sign in.
- Impersonation, when used through Better Auth, temporarily acts as the target
  user and is limited to one hour in this configuration.
