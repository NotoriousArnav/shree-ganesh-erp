import { randomUUID } from "node:crypto";

export type MailRecipients = string | string[];

export type MailMessage = {
  to: MailRecipients;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: MailRecipients;
  bcc?: MailRecipients;
  replyTo?: string;
};

export type RenderedMail = {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  date: Date;
};

export type MailResult = {
  id: string;
  transport: string;
  to: string[];
  subject: string;
  /** Local file the message was written to, for file-backed transports. */
  savedTo?: string;
  /** Provider-assigned message id, for network transports. */
  messageId?: string;
};

/** What a transport reports back after handing a message off. */
export type DeliveryResult =
  | void
  | {
      savedTo?: string;
      messageId?: string;
    };

/**
 * Base class for every mail transport.
 *
 * `send()` owns validation and normalisation so concrete transports only have
 * to implement `deliver()`. An SMTP transport extends this class and sends via
 * a socket; the console transport writes to the terminal and /tmp.
 */
export abstract class AbstractMailer {
  abstract readonly transport: string;

  constructor(protected readonly defaults: { from: string }) {}

  async send(message: MailMessage): Promise<MailResult> {
    const mail = this.render(message);
    const delivery = await this.deliver(mail);

    return {
      id: mail.id,
      transport: this.transport,
      to: mail.to,
      subject: mail.subject,
      ...(delivery?.savedTo ? { savedTo: delivery.savedTo } : {}),
      ...(delivery?.messageId ? { messageId: delivery.messageId } : {}),
    };
  }

  protected render(message: MailMessage): RenderedMail {
    const to = normalizeRecipients(message.to);
    if (to.length === 0) {
      throw new Error("Mail requires at least one recipient in `to`.");
    }

    const subject = message.subject.trim();
    if (!subject) {
      throw new Error("Mail requires a non-empty `subject`.");
    }

    return {
      id: randomUUID(),
      from: message.from?.trim() || this.defaults.from,
      to,
      cc: normalizeRecipients(message.cc),
      bcc: normalizeRecipients(message.bcc),
      replyTo: message.replyTo?.trim() || undefined,
      subject,
      text: message.text ?? (message.html ? stripHtml(message.html) : ""),
      html: message.html,
      date: new Date(),
    };
  }

  protected abstract deliver(mail: RenderedMail): Promise<DeliveryResult>;
}

export function normalizeRecipients(value: MailRecipients | undefined): string[] {
  if (!value) return [];

  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => item.trim()).filter(Boolean);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}
