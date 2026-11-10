# Managing users

Every person who signs in has a user row with one of four roles and, for shop
roles, a link to exactly one shop.

## The user list

The **Users** table on `/admin` shows every account across the platform:

| Column | Meaning |
| --- | --- |
| **Name** | Display name. |
| **Email** | Sign-in identifier, unique. |
| **Phone** | Phone sign-in identifier, unique when present. |
| **Role** | Super Admin, Dev, Merchant or Staff. |
| **Merchant** | Shop name for shop accounts, otherwise a dash. |

The list is read-only. Create owners through **Add merchant**, staff through the
shop's **Staff** screen, and use the API, CLI or Drizzle Studio for anything
else.

## Roles

| Role | Scope | Can do |
| --- | --- | --- |
| `super_admin` | Platform | Everything in the admin area; every platform action. |
| `dev` | Platform | The same admin screens, intended for support. |
| `merchant` | One shop | Full shop access, staff and settings. |
| `staff` | One shop | Day-to-day work limited by three permissions. |

The database constrains the role to these four values. Shop roles must have a
`merchant_id`; platform roles must not need one.

## Add a shop owner

Owners are created when you add a merchant, or afterwards from the API:

```bash
BASE=http://localhost:8080
JAR=/tmp/mushak-admin.cookies

curl -s -c "$JAR" -H 'content-type: application/json' \
  -d '{"email":"admin@mushak.local","password":"admin123"}' \
  "$BASE/api/auth/sign-in/email"

curl -s -b "$JAR" -H 'content-type: application/json' \
  -d '{
    "name":"Second Owner",
    "email":"owner2@shop.in",
    "password":"a-strong-password",
    "phoneNumber":"+919876543211"
  }' \
  "$BASE/api/admin/merchants/<merchantId>/users"
```

The endpoint always creates a `merchant` account in that shop. Omit
`permissions` for the full set. There is no screen for adding a second owner.

## Create a user from the CLI

For platform roles and for repair work:

```bash
npm run user:create -- \
  --email owner@shop.in \
  --password 'a-strong-password' \
  --name 'Shop Owner' \
  --role merchant \
  --merchant ganesh-kirana \
  --phone +919876543210
```

| Flag | Required | Notes |
| --- | --- | --- |
| `--email` | Yes | Lowercased before saving. |
| `--password` | Yes | Used only when the account is new. |
| `--name` | No | Defaults to `Mushak User`. |
| `--role` | No | Defaults to `staff`. One of the four roles. |
| `--merchant` | For shop roles | Merchant id or slug. Rejected for platform roles. |
| `--phone` | No | Enables phone sign-in; use E.164. |

If the email already exists, the script updates its name, role, shop link,
phone and unban state. It does **not** change the password of an existing
account. The script enables sign-up for its own process only; the running server
still rejects public sign-up.

## Roles and shop links

The admin UI does not edit roles or shop links. Use Drizzle Studio:

```bash
npm run db:studio
```

Then edit `users.role` and `users.merchant_id`. Keep these rules:

- `merchant` and `staff` need a valid `merchant_id`;
- `super_admin` and `dev` should have `merchant_id` null;
- `users.role` must be one of the four values;
- a shop role without a shop cannot use the shop API and sees no data.

After changing a role, the user may need to sign out and in again because the
session response is cached in the browser.

## Passwords

| Situation | How to fix it |
| --- | --- |
| Staff forgot the password | Shop owner: **Staff → Reset password**. |
| Owner forgot the password | Use the email reset flow; the link is in the inbox with `MAIL_DRIVER=smtp`, or in `/tmp/mushak-mail` with the console driver. |
| Owner has no working email | Update the email in the database, then use the reset flow. |
| Platform admin forgot the password | `npm run user:reset-password -- --email admin@mushak.local --password '<new-password>'`. |

Resetting a staff password deletes that account's sessions. It does not change
permissions.

Reset any password from the CLI, without mail:

```bash
npm run user:reset-password -- \
  --email admin@mushak.local \
  --password '<new-password>'
```

The script uses Better Auth's hasher, creates the credential account if it is
missing, and revokes the user's existing sessions. `seed:admin` only creates the
account or repairs its role; it does not change the password of an existing
user.

## Deactivation

Staff are deactivated by the shop owner from the Staff screen. For other
accounts, set `users.banned = true` in Drizzle Studio, or use the Better Auth
admin API. A banned account cannot sign in and existing sessions are removed by
the shop flow.

The sign-in screen shows the configured banned-account message:
`This account has been deactivated. Ask your administrator or shop owner to
reactivate it.`

Deactivation keeps the account id on stock movements, so history stays
attributable.

## Impersonation

The authentication layer is Better Auth's admin plugin, which supports
impersonation for platform administrators. There is no button for it in the
admin UI today. If you use it through the API, remember:

- the impersonated session is short-lived (one hour in this configuration);
- actions are recorded against the impersonated user;
- stop impersonation when support work is done.

## Uniqueness and validation

- Email is required, lowercased and unique across the platform.
- Phone is optional and unique when present. Ten-digit numbers are stored with
  a `+91` prefix.
- Names are 1 to 120 characters.
- Passwords are 8 to 128 characters.
- A duplicate email or phone returns `409` with a message naming the field.

## Permissions

Only `super_admin` and `dev` can list users or create shop owners. Shop owners
can create and manage staff only inside their own shop. Staff cannot manage any
account.
