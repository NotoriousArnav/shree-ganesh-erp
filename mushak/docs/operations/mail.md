# Mail

Mushak sends password-reset and email-verification messages through a small
mailer abstraction with two transports:

| Driver | Use |
| --- | --- |
| `console` (default) | Development. Prints the message and writes files. |
| `smtp` | Any SMTP provider. Delivers real email. |

## How the mailer works

`mushak/backend/src/mail/mailer.ts` defines `AbstractMailer`. It owns validation,
recipient normalisation, the message id, and the text/HTML body. A transport
only implements `deliver()`, so the console and SMTP drivers send identical
content.

`getMailer()` selects a transport from `MAIL_DRIVER` once per process.

`MailResult` reports what happened:

```ts
{
  id: string;          // stable id for this message
  transport: string;   // "console" or "smtp"
  to: string[];
  subject: string;
  savedTo?: string;    // console: .eml path
  messageId?: string;  // smtp: provider message id
}
```

## Console transport

For every message the console mailer:

- prints From, To, Subject and the text body to the backend terminal;
- writes a `.eml` copy and a `.json` copy to `MAIL_DIR`;
- creates files with mode `0600`;
- uses a generated unique filename.

```dotenv
MAIL_DRIVER=console
MAIL_FROM=Mushak <no-reply@mushak.local>
MAIL_DIR=/tmp/mushak-mail
```

## SMTP transport

`SmtpMailer` uses [Nodemailer](https://nodemailer.com/) and connects to any
standard SMTP server. It supports STARTTLS (port 587), implicit TLS (port 465),
authenticated relays, and unauthenticated local servers such as Mailpit.

```dotenv
MAIL_DRIVER=smtp
MAIL_FROM=Mushak <no-reply@yourdomain.in>

SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=your-username
SMTP_PASS=your-password
```

| Variable | Default | Notes |
| --- | --- | --- |
| `SMTP_HOST` | none | Required when `MAIL_DRIVER=smtp`. |
| `SMTP_PORT` | `587` | `465` when `SMTP_SECURE=true` and no port is set. |
| `SMTP_SECURE` | `true` when port is `465` | `true` for implicit TLS. |
| `SMTP_REQUIRE_TLS` | `true` when not secure | Upgrades with STARTTLS. Set `false` only for a local plaintext relay. |
| `SMTP_USER` | none | Leave empty for an unauthenticated relay. Must be set with `SMTP_PASS`. |
| `SMTP_PASS` | none | Password or provider API key. |
| `SMTP_ALLOW_INVALID_CERT` | `false` | Development only; accepts self-signed certificates. |
| `SMTP_TIMEOUT_MS` | `10000` | Connection, greeting and socket timeout. |

The transport pools up to three connections and keeps the last error from the
server in the thrown exception, so a failed reset surfaces in the backend log
instead of disappearing.

### Provider recipes

Most providers accept these values. Use the provider's SMTP credentials, not
your account password.

| Provider | Host | Port | User |
| --- | --- | --- | --- |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | `587` | SMTP username |
| Resend | `smtp.resend.com` | `587` | `resend` |
| Postmark | `smtp.postmarkapp.com` | `587` | Server token (both user and password) |
| Mailgun | `smtp.mailgun.org` | `587` | Postmaster address |
| Brevo | `smtp-relay.brevo.com` | `587` | SMTP login |
| Gmail | `smtp.gmail.com` | `587` | Address + app password |

Gmail needs an app password and is not recommended for a shop's transactional
mail; use a provider with a verified sending domain.

### Local SMTP test server

[Mailpit](https://mailpit.axllent.org/) or
[MailHog](https://github.com/mailhog/MailHog) accept mail without credentials:

```dotenv
MAIL_DRIVER=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_REQUIRE_TLS=false
```

Messages appear in the Mailpit web UI at <http://localhost:8025>.

## Sending-domain setup

Before production, point the provider at a domain you control and publish:

- **SPF** — authorises the provider's servers;
- **DKIM** — signs the message;
- **DMARC** — tells receivers what to do when SPF or DKIM fails;
- a real `MAIL_FROM` on that domain, for example
  `Mushak <no-reply@shop.example.in>`.

A reset email that lands in spam is indistinguishable from a broken reset flow.

## Testing

```bash
npm run mail:test
npm run mail:test -- someone@shop.in
```

The sample message exercises the same code path as a real reset. With
`MAIL_DRIVER=console` it prints to the terminal; with `MAIL_DRIVER=smtp` it
sends through the configured server.

Check the transport without sending mail to a customer:

```bash
MAIL_DRIVER=smtp SMTP_HOST=smtp.example.com SMTP_USER=... SMTP_PASS=... \
  npm run mail:test -- you@example.com
```

The script prints `transport`, `messageId` and, for the console driver,
`savedTo`.

## Password-reset flow

1. The user chooses **Forgot password?** on `/login`.
2. The frontend calls `POST /api/auth/request-password-reset` with the email and
   `redirectTo: <origin>/reset-password`.
3. Better Auth calls the mailer with a link containing a one-time token.
4. The transport delivers the link:
   - `console` — terminal and newest file under `MAIL_DIR`;
   - `smtp` — the recipient's inbox.
5. Open the link, choose a new password, and sign in.

```bash
ls -lt /tmp/mushak-mail | head
cat "$(ls -t /tmp/mushak-mail/*.json | head -1)"
```

The response to the request is deliberately the same whether or not the email
exists.

## Phone-only accounts

Self-service reset needs an email. A phone-only staff account is reset by the
shop owner from **Staff → Reset password**, which uses the staff API and does
not send mail.

## Verification mail

`auth.ts` also wires `sendVerificationEmail`. The current account creation flows
mark email verification as not required, so this message is rarely sent. If you
turn verification on, it uses the same mailer and the same configuration.

## Security notes

- Reset tokens are single-use and time-limited.
- Do not log full reset URLs in production logs.
- Files in `MAIL_DIR` contain live tokens until used or expired. Keep the
  directory private, or keep `MAIL_DRIVER=console` only on developer machines.
- Changing `BETTER_AUTH_SECRET` invalidates outstanding tokens.
- A reset signs the account out of existing sessions.
- SMTP credentials are secrets. Set them through the process manager, never in
  a committed file.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No message in the terminal | Is `MAIL_DRIVER` still `console`? Is the backend logging? |
| `MAIL_DRIVER=smtp requires SMTP_HOST` | `SMTP_HOST` is empty or missing |
| `SMTP_USER and SMTP_PASS must be set together` | Usually one of the two was left behind when copying an env file |
| `Unsupported MAIL_DRIVER` | Use `console` or `smtp` |
| `EAUTH` / `535` from the SMTP server | Wrong username, password, or provider API key |
| `ETIMEDOUT` | Firewall or wrong port; try `465` with `SMTP_SECURE=true` |
| `certificate` error | Use a valid certificate, or `SMTP_ALLOW_INVALID_CERT=true` in development only |
| Mail is delivered but in spam | SPF, DKIM and DMARC records |
| Link says invalid or expired | Request a new one; tokens are single-use |

See [Mail API notes](../api/auth.md#request-a-password-reset).
