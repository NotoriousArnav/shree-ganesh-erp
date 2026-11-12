# Troubleshooting

Start with the message on screen. Most problems fall into a small number of
causes: the wrong sign-in identifier, a missing permission, an archived product,
or the backend being unavailable.

## Sign-in

### “Invalid email/phone or password”

- The identifier may be wrong. Try the email address if you usually use the
  phone, or the other way round.
- Passwords are case-sensitive and are not trimmed. Re-type the password rather
  than pasting it.
- A shop account cannot sign in at the admin area and vice versa; both use the
  same sign-in screen and are redirected by role.

### “This account has been deactivated”

The shop owner or a platform administrator deactivated the account. Ask them to
reactivate it. Resetting the password does not reactivate an account.

### “Invalid origin” when signing in

The backend only accepts sign-in requests from origins it trusts. Development
trusts every origin, so this error only appears when `NODE_ENV=production`.

- `http://localhost:5173`, `http://127.0.0.1:5173`, a LAN address, an mDNS name
  such as `http://laptop.local:5173`, or a tunnel — all accepted in development.
- In production, add the exact origin (scheme, host and port) to
  `TRUSTED_ORIGINS` and restart the backend:

```dotenv
TRUSTED_ORIGINS=https://shop.example.in,https://mushak.example.in
```

- To accept every origin in production, set `TRUSTED_ORIGINS=*`. This turns
  Better Auth's origin and redirect checks off; the session cookie still uses
  `SameSite=Lax`. Prefer listing the real origins.

The backend log names the rejected origin and prints the trusted list.

### The page keeps returning to sign-in

The browser is not keeping the session cookie. Check:

- the frontend and API are reached through the same host name (`localhost` and
  `127.0.0.1` are different hosts for cookies);
- the browser is not blocking cookies for the site;
- a deployed frontend's origin is listed in `TRUSTED_ORIGINS` on the backend;
- the backend restarted with the same `BETTER_AUTH_SECRET`; changing the secret
  invalidates every session.

### The server is not responding

Confirm the backend is running:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/health/db
curl http://localhost:8080/health/storage
```

`/health/db` returning 503 means Postgres is down. Start it with `npm run db:up`
and check `docker compose -f mushak/backend/docker-compose.yml ps`.

## Password reset

### The email never arrives

In development `MAIL_DRIVER=console`. No mail leaves the machine:

- the message is printed in the backend terminal;
- an `.eml` and `.json` copy is written to `MAIL_DIR`
  (`/tmp/mushak-mail` by default).

Open the newest file and copy the reset link. If the directory is empty, check
that the backend process has write access.

In production the transport is configured with `MAIL_DRIVER=smtp`. If mail does
not arrive there, check the SMTP credentials and the provider's SPF, DKIM and
DMARC records. See [Mail](../operations/mail.md).

### “Reset link is invalid or expired”

Reset links are single-use and time-limited. Request a new one from
**Forgot password?**. Requesting a new link does not invalidate an account.

### The account has no email

Self-service reset needs an email address. A phone-only staff account must be
reset by the shop owner from **Staff → Reset password**.

## Products and stock

### A product is missing from the list

- Check the search box and the category filter.
- Tick **Show archived**; archived products are hidden by default.
- You may be signed in to a different shop; the shop name is in the sidebar.
- Staff see the same catalogue, so a missing product is a shop-wide issue, not
  a permission issue.

### “A product with that SKU/barcode already exists”

SKUs and barcodes are unique per shop. Find the existing product by searching
for the code, then either edit it or choose a different code for the new
product. Leaving the SKU blank generates a free one.

### Stock will not go negative

Mushak refuses a movement that would take the quantity below zero. The message
names the available quantity. Record a purchase, a customer return or an
adjustment first, or correct the quantity you typed.

### “This product is archived. Restore it before moving stock.”

Open **Catalogue**, tick **Show archived**, and choose **Restore**. Then move
stock from Inventory or the product detail page.

### The quantity does not match the shelf

1. Open **Stock** and filter by the product.
2. Compare the movements with what actually happened.
3. Record an `adjustment` for the difference with a note explaining the stock
   take.

Do not edit the database quantity directly; it would leave the history and the
cached total inconsistent.

### I cannot edit a product

- Staff need the **Catalogue** permission.
- Archived products must be restored first.
- Stock quantities are never edited from the product form; use **Stock**.

## Buttons and screens are missing

Permissions control changes, not visibility of the main product screens. The
sidebar hides **Stock** without the stock permission, **Categories** without the
categories permission, and **Staff** and **Settings** for every staff account.
Opening a hidden address directly shows a permission or role message.

Ask the shop owner to tick the permission in **Staff → Edit**. Permission changes
take effect on the next profile load; reload the page if the sidebar is stale.

## Image uploads fail

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Upload button reports a network error | Object storage is down or unreachable | Check `/health/storage` and the RustFS container. |
| Browser blocks the upload with a CORS message | The frontend origin is not in the bucket CORS policy | Add the origin to `TRUSTED_ORIGINS` and restart the backend; the policy is rewritten on first use. |
| “Storage is not configured” | `S3_BUCKET` or credentials are missing | Fill in the storage variables and restart. |
| “The image key must stay inside the merchant's own storage prefix” | A key from another shop or a hand-edited form | Re-upload the image from this shop's form. |
| 413 or “file too large” | The UI accepts images up to 5 MB; the direct API path allows 25 MB | Use a smaller file. |
| Image saves but shows a broken tile | The object was deleted outside Mushak | Re-upload, or clear the image and save. |

Details are in [Object storage](../operations/storage.md).

## Dashboard numbers look wrong

- The Dashboard does not poll. Choose **Refresh** after another user changes
  stock.
- Low stock ignores products whose reorder level is `0`.
- Stock value uses the **current** purchase price, not the historical cost of
  each unit.
- Today's totals start at local midnight on the server, not at the browser's
  midnight if the two time zones differ.

## Phone or LAN access

A phone on the same Wi-Fi opens `http://<laptop-lan-ip>:5173`.

- The firewall must allow the Vite port and the backend port.
- In development the backend trusts the machine's LAN addresses automatically.
- A deployed frontend on another host needs `TRUSTED_ORIGINS` and bucket CORS.
- `localhost` on the phone means the phone itself, not the laptop.

## The installed app shows an old version

The PWA caches its shell. Close and reopen it, or clear the site data for the
app in the browser settings. A hard reload in the browser (Ctrl+Shift+R) also
fetches the new build.

## Getting help

Collect this before asking an administrator:

1. The exact message on screen.
2. The time it happened.
3. The shop and account name.
4. The output of `/health`, `/health/db` and `/health/storage`.
5. The backend log lines from the same time.

Server-side diagnostics are in
[Operations troubleshooting](../operations/troubleshooting.md).
