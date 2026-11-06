import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { AbstractMailer, type RenderedMail } from "./mailer.js";

export type ConsoleMailerOptions = {
  from: string;
  /** Directory for .eml and .json copies. Defaults to MAIL_DIR or /tmp/mushak-mail. */
  dir?: string;
};

/**
 * Development transport: prints the message to the terminal and writes the
 * raw MIME message plus a JSON record to /tmp.
 *
 * Never use this in production: password-reset and verification links would be
 * written to the server's temporary directory.
 */
export class ConsoleMailer extends AbstractMailer {
  readonly transport = "console";
  private readonly dir: string;

  constructor(options: ConsoleMailerOptions) {
    super({ from: options.from });
    this.dir = options.dir ?? process.env.MAIL_DIR ?? "/tmp/mushak-mail";

    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[mail] ConsoleMailer is active in production. Mail is written to " +
          `${this.dir} instead of being delivered. Set MAIL_DRIVER=smtp.`,
      );
    }
  }

  protected async deliver(mail: RenderedMail): Promise<string> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });

    const stamp = mail.date.toISOString().replace(/[:.]/g, "-");
    const slug =
      mail.to[0]
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "mail";
    const base = `${stamp}-${slug}-${mail.id.slice(0, 8)}`;
    const emlPath = join(this.dir, `${base}.eml`);
    const jsonPath = join(this.dir, `${base}.json`);

    await writeFile(emlPath, toEml(mail), { encoding: "utf8", mode: 0o600 });
    await writeFile(
      jsonPath,
      `${JSON.stringify(
        {
          id: mail.id,
          from: mail.from,
          to: mail.to,
          cc: mail.cc,
          bcc: mail.bcc,
          replyTo: mail.replyTo ?? null,
          subject: mail.subject,
          date: mail.date.toISOString(),
          text: mail.text,
          html: mail.html ?? null,
          emlPath,
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", mode: 0o600 },
    );

    printMail(mail, emlPath, jsonPath);
    return emlPath;
  }
}

function printMail(mail: RenderedMail, emlPath: string, jsonPath: string) {
  const line = "─".repeat(72);
  const rows = [
    `From:    ${mail.from}`,
    `To:      ${mail.to.join(", ")}`,
    ...(mail.cc.length > 0 ? [`Cc:      ${mail.cc.join(", ")}`] : []),
    ...(mail.bcc.length > 0 ? [`Bcc:     ${mail.bcc.join(", ")}`] : []),
    `Subject: ${mail.subject}`,
    `Date:    ${mail.date.toISOString()}`,
    `Saved:   ${emlPath}`,
    `         ${jsonPath}`,
  ];

  const body = mail.text.trim() || "(no text body)";

  console.log(
    [
      "",
      line,
      `📬 ConsoleMailer  ${mail.id}`,
      line,
      ...rows,
      line,
      body,
      line,
      "",
    ].join("\n"),
  );
}

function toEml(mail: RenderedMail): string {
  const headers = [
    `From: ${encodeHeader(mail.from)}`,
    `To: ${mail.to.map(encodeHeader).join(", ")}`,
    ...(mail.cc.length > 0
      ? [`Cc: ${mail.cc.map(encodeHeader).join(", ")}`]
      : []),
    ...(mail.bcc.length > 0
      ? [`Bcc: ${mail.bcc.map(encodeHeader).join(", ")}`]
      : []),
    ...(mail.replyTo ? [`Reply-To: ${encodeHeader(mail.replyTo)}`] : []),
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${mail.date.toUTCString()}`,
    `Message-ID: <${mail.id}@mushak.local>`,
    "MIME-Version: 1.0",
  ];

  if (mail.html) {
    const boundary = `mushak-${randomUUID()}`;
    const body = [
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      mail.text,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      mail.html,
      "",
      `--${boundary}--`,
      "",
    ];
    return `${headers.join("\r\n")}\r\n${body.join("\r\n")}`;
  }

  const body = [
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    mail.text,
    "",
  ];
  return `${headers.join("\r\n")}\r\n${body.join("\r\n")}`;
}

/** MIME encoded-word for headers that contain non-ASCII characters. */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
