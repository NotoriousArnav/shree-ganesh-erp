import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import {
  AbstractMailer,
  type DeliveryResult,
  type RenderedMail,
} from "./mailer.js";

export type SmtpMailerOptions = {
  from: string;
  host: string;
  /** Defaults to 587 (submission) or 465 when `secure` is true. */
  port?: number;
  /** Implicit TLS. True for port 465; false for STARTTLS on 587. */
  secure?: boolean;
  user?: string;
  pass?: string;
  /** Upgrade a plaintext connection with STARTTLS. Defaults to true when not secure. */
  requireTLS?: boolean;
  /** Allow self-signed certificates. Development only. */
  allowInvalidCert?: boolean;
  /** Connection, greeting and socket timeout in milliseconds. */
  timeoutMs?: number;
};

/**
 * Production transport. Talks to any SMTP provider: Amazon SES, Resend,
 * Postmark, Mailgun, Brevo, a local Mailpit, or a corporate relay.
 *
 * The base class already validated recipients and rendered text/HTML, so this
 * only owns the connection and the handoff to the SMTP server.
 */
export class SmtpMailer extends AbstractMailer {
  readonly transport = "smtp";
  private readonly transporter: Transporter;

  constructor(options: SmtpMailerOptions) {
    super({ from: options.from });

    const secure = options.secure ?? false;
    const timeout = options.timeoutMs ?? 10_000;

    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port ?? (secure ? 465 : 587),
      secure,
      requireTLS: options.requireTLS ?? !secure,
      auth: options.user
        ? { user: options.user, pass: options.pass ?? "" }
        : undefined,
      tls: options.allowInvalidCert ? { rejectUnauthorized: false } : undefined,
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout * 3,
    });
  }

  protected async deliver(mail: RenderedMail): Promise<DeliveryResult> {
    const info = await this.transporter.sendMail({
      from: mail.from,
      to: mail.to,
      cc: mail.cc.length > 0 ? mail.cc : undefined,
      bcc: mail.bcc.length > 0 ? mail.bcc : undefined,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      date: mail.date,
      headers: {
        "X-Mailer": "Shree Ganesh ERP",
        "X-Mail-ID": mail.id,
      },
    });

    const rejected = info.rejected ?? [];
    if (rejected.length > 0) {
      throw new Error(
        `SMTP server rejected ${rejected.length} recipient(s): ${rejected
          .map(formatAddress)
          .join(", ")}`,
      );
    }

    const accepted = info.accepted ?? [];
    console.log(
      `[mail] smtp accepted ${accepted.length} recipient(s) for ${mail.id} (${info.messageId})`,
    );

    return { messageId: info.messageId };
  }

  /** Closes pooled connections. Useful for scripts and graceful shutdown. */
  close(): void {
    this.transporter.close();
  }
}

function formatAddress(
  value: string | { address?: string; name?: string },
): string {
  if (typeof value === "string") return value;
  return value.address ?? value.name ?? String(value);
}
