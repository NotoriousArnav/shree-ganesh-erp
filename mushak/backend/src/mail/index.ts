import { ConsoleMailer } from "./console-mailer.js";
import type { AbstractMailer } from "./mailer.js";
import { SmtpMailer } from "./smtp-mailer.js";

export { AbstractMailer } from "./mailer.js";
export type {
  DeliveryResult,
  MailMessage,
  MailRecipients,
  MailResult,
  RenderedMail,
} from "./mailer.js";
export { ConsoleMailer } from "./console-mailer.js";
export { SmtpMailer } from "./smtp-mailer.js";
export type { SmtpMailerOptions } from "./smtp-mailer.js";

let mailer: AbstractMailer | null = null;

/**
 * Resolves the configured transport once per process.
 *
 * MAIL_DRIVER=console (default) prints and saves to /tmp.
 * MAIL_DRIVER=smtp delivers through any SMTP server.
 *
 * Add a new provider by extending AbstractMailer and selecting it here.
 */
export function getMailer(): AbstractMailer {
  if (mailer) return mailer;

  const driver = (process.env.MAIL_DRIVER ?? "console").toLowerCase();
  const from = process.env.MAIL_FROM ?? "Mushak <no-reply@mushak.local>";

  if (driver === "console") {
    mailer = new ConsoleMailer({ from, dir: process.env.MAIL_DIR });
    return mailer;
  }

  if (driver === "smtp") {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      throw new Error(
        "MAIL_DRIVER=smtp requires SMTP_HOST. Set SMTP_HOST, SMTP_PORT, " +
          "SMTP_USER and SMTP_PASS, or switch to MAIL_DRIVER=console.",
      );
    }

    const port = envInt("SMTP_PORT", 587);
    const secure = envBool("SMTP_SECURE", port === 465);
    const user = envValue("SMTP_USER");
    const pass = process.env.SMTP_PASS;

    if ((user && !pass) || (!user && pass)) {
      throw new Error(
        "SMTP_USER and SMTP_PASS must be set together. Leave both empty for " +
          "an unauthenticated relay.",
      );
    }

    mailer = new SmtpMailer({
      from,
      host,
      port,
      secure,
      user,
      pass,
      requireTLS: envBool("SMTP_REQUIRE_TLS", !secure),
      allowInvalidCert: envBool("SMTP_ALLOW_INVALID_CERT", false),
      timeoutMs: envInt("SMTP_TIMEOUT_MS", 10_000),
    });
    return mailer;
  }

  throw new Error(
    `Unsupported MAIL_DRIVER "${driver}". Use "console" or "smtp".`,
  );
}

/** Closes pooled connections and clears the cache. Safe to call more than once. */
export function closeMailer(): void {
  if (mailer instanceof SmtpMailer) mailer.close();
  mailer = null;
}

/** Test hook: drop the cached transport so a new environment can be read. */
export function resetMailer(): void {
  closeMailer();
}

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function envInt(name: string, fallback: number): number {
  const raw = envValue(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return parsed;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = envValue(name)?.toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  throw new Error(`${name} must be true or false, got "${raw}".`);
}
