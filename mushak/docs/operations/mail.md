# Mail

Mushak sends password-reset and email-verification messages through a small
mailer abstraction. Only one transport exists today: the console mailer.

## How the mailer works

`mushak/backend/src/mail/mailer.ts` defines `AbstractMailer`. It owns
validation, recipient handling, the message id and the MIME body. A transport
implements `deliver()`.

`getMailer()` selects a transport from `MAIL_DRIVER` once per process.

| Driver | Behaviour |
| --- | --- |
| `console` (default) | Prints the message and writes files |
| anything else | Throws `Unsupported MAIL_DRIVER` |

There is no SMTP transport in the repository yet.

## Console behaviour

For every message the console mailer:

- prints From, To, Subject and the text body to the backend terminal;
- writes a `.eml` copy and a `.json` copy to `MAIL_DIR`;
- creates files with mode `0600`;
- uses a generated unique filename.

Defaults:

```dotenv
MAIL_DRIVER=console
MAIL_FROM=Mushak <no-reply@mushak.local>
MAIL_DIR=/tmp/mushak-mail
```

## Testing

```bash
npm run mail:test
npm run mail:test -- someone@shop.in
```

The sample message exercises the same code path as a real reset.

## Password-reset flow

1. The user chooses **Forgot password?** on `/login`.
2. The frontend calls `POST /api/auth/request-password-reset` with the email and
   `redirectTo: <origin>/reset-password`.
3. Better Auth calls the mailer with a link containing a one-time token.
4. With `MAIL_DRIVER=console`, the link is in the terminal and in the newest
   file under `MAIL_DIR`.
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

## Production

The console mailer is safe for development but not for a public deployment:

- users never receive the link;
- the reset link lands on the server's disk;
- `/tmp` may be cleared on reboot.

Before exposing self-service resets:

1. Add an SMTP transport that extends `AbstractMailer` and implements
   `deliver()`.
2. Select it in `getMailer()` when `MAIL_DRIVER=smtp`.
3. Add host, port, user, password and TLS variables to the environment.
4. Set a real `MAIL_FROM` on a domain with SPF, DKIM and DMARC.
5. Test the full browser flow, including an expired link.
6. Restrict read access to `MAIL_DIR` until the console driver is no longer
   used.

A minimal transport sketch:

```ts
class SmtpMailer extends AbstractMailer {
  protected async deliver(rendered: RenderedMail): Promise<void> {
    // hand rendered.raw / rendered.html to your SMTP library
  }
}
```

Keep the base class responsible for validation and rendering so every transport
sends the same content.

## Verification mail

`auth.ts` also wires `sendVerificationEmail`. The current account creation flows
mark email verification as not required, so this message is rarely sent. If you
turn verification on, it uses the same mailer and the same limitations.

## Security notes

- Reset tokens are single-use and time-limited.
- Do not log full reset URLs in production logs.
- Files in `MAIL_DIR` contain live tokens until used or expired.
- Changing `BETTER_AUTH_SECRET` invalidates outstanding tokens.
- A reset signs the account out of existing sessions.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No message in the terminal | Is `MAIL_DRIVER` still `console`? Is the backend logging? |
| Directory is empty | `MAIL_DIR` path and write permission |
| Link says invalid or expired | Request a new one; tokens are single-use |
| No mail in production | Expected: only the console driver exists |
| `Unsupported MAIL_DRIVER` at startup | Only `console` is implemented; remove the value or add a driver |

See [Mail API notes](../api/auth.md#request-a-password-reset).
