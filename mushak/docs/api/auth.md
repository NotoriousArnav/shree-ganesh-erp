# Authentication API

Better Auth owns every endpoint under `/api/auth`. The Fastify backend forwards
those requests to it unchanged, so request and response bodies follow Better
Auth's conventions, not the `{ "error": … }` shape used elsewhere.

Public sign-up is disabled. Accounts are provisioned by an administrator or a
shop owner.

## Sign in with email

`POST /api/auth/sign-in/email`

```json
{
  "email": "merchant@mushak.local",
  "password": "merchant-pass-123"
}
```

On success the response sets the session cookie and returns the user and
session. The user object includes `role` and, for shop accounts,
`merchantId`.

```bash
curl -s -c /tmp/mushak.cookies -H 'content-type: application/json' \
  -d '{"email":"merchant@mushak.local","password":"merchant-pass-123"}' \
  http://localhost:8080/api/auth/sign-in/email
```

| Status | Meaning |
| --- | --- |
| `200` | Signed in; cookie set |
| `400` | Missing or malformed body |
| `401` | Wrong email or password |
| `429` | Rate limited, when enabled in the deployment |

## Sign in with phone

`POST /api/auth/sign-in/phone-number`

```json
{
  "phoneNumber": "+919876543210",
  "password": "merchant-pass-123"
}
```

The phone must match the stored value. Staff and owner creation normalise a
ten-digit Indian number to `+91XXXXXXXXXX`; send the same form.

SMS one-time codes are not configured. Only password sign-in works.

## Current session

`GET /api/auth/get-session`

```bash
curl -s -b /tmp/mushak.cookies http://localhost:8080/api/auth/get-session
```

Returns the session and user, or `null` when there is no valid session. A
banned account's session is rejected.

The frontend uses this to decide between the shop area and the admin area.

## Sign out

`POST /api/auth/sign-out`

```bash
curl -s -b /tmp/mushak.cookies -X POST http://localhost:8080/api/auth/sign-out
```

Clears the session on this device.

## Request a password reset

`POST /api/auth/request-password-reset`

```json
{
  "email": "merchant@mushak.local",
  "redirectTo": "http://localhost:5173/reset-password"
}
```

The endpoint always responds successfully for a valid request, whether or not
the email exists, to avoid revealing accounts. When it exists, the mailer sends
a link to `redirectTo?token=…`.

In development the console mailer writes the message to `MAIL_DIR`
(`/tmp/mushak-mail`) instead of sending it. With `MAIL_DRIVER=smtp` the link is
delivered to the account's inbox.

```bash
ls -t /tmp/mushak-mail | head
```

## Reset the password

`POST /api/auth/reset-password`

```json
{
  "newPassword": "a-new-password",
  "token": "token-from-the-email"
}
```

The token is single-use and expires. On success every existing session for the
account is invalidated by Better Auth's reset flow; sign in again with the new
password.

| Status | Meaning |
| --- | --- |
| `200` | Password changed |
| `400` | Weak password or invalid/expired token |

## Phone-only accounts

Self-service reset needs an email address. A phone-only staff account is reset
by the shop owner with `POST /api/merchant/staff/{id}/password`.

## Cookies and origins

- The cookie is http-only and sent automatically by the browser.
- The backend trusts `FRONTEND_URL`, `BETTER_AUTH_URL` and anything in
  `TRUSTED_ORIGINS`. Development trusts every origin, so any host, port or
  tunnel works while running the dev server.
- `NODE_ENV=production` enforces the list. A request from an untrusted origin
  fails with `403 INVALID_ORIGIN`; add the exact origin, or set
  `TRUSTED_ORIGINS=*` to accept every origin.
- Changing `BETTER_AUTH_SECRET` invalidates all sessions.

## Not documented here

Better Auth also exposes account-linking, verification and admin-plugin routes.
Mushak does not call them from the UI. Use the Better Auth documentation if you
need them, and treat them as internal to the auth layer rather than part of the
Mushak contract.
