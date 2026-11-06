import { ConsoleMailer } from "./console-mailer.js";
import type { AbstractMailer } from "./mailer.js";

export { AbstractMailer } from "./mailer.js";
export type {
  MailMessage,
  MailRecipients,
  MailResult,
  RenderedMail,
} from "./mailer.js";
export { ConsoleMailer } from "./console-mailer.js";

let mailer: AbstractMailer | null = null;

/**
 * Resolves the configured transport once per process.
 *
 * MAIL_DRIVER=console (default) prints and saves to /tmp.
 * An SMTP transport can be added later without touching callers.
 */
export function getMailer(): AbstractMailer {
  if (mailer) return mailer;

  const driver = (process.env.MAIL_DRIVER ?? "console").toLowerCase();
  const from = process.env.MAIL_FROM ?? "Mushak <no-reply@mushak.local>";

  if (driver === "console") {
    mailer = new ConsoleMailer({ from, dir: process.env.MAIL_DIR });
    return mailer;
  }

  throw new Error(
    `Unsupported MAIL_DRIVER "${driver}". Only "console" is implemented.`,
  );
}
