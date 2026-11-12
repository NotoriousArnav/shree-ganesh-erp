import "dotenv/config";

import { getMailer } from "@ganesh/server/mail";

const to = process.argv[2] ?? "test@mushak.local";
const mailer = getMailer();

console.log(`Sending through the "${mailer.transport}" transport to ${to}…`);

const result = await mailer.send({
  to,
  subject: "Mushak mailer test · नमस्ते",
  text: [
    "Hello from the Mushak mailer.",
    "",
    "If you can read this in an inbox, delivery is configured correctly.",
  ].join("\n"),
  html: [
    "<h1>Mushak mailer</h1>",
    "<p>Hello from the <strong>Mushak mailer</strong>.</p>",
    "<p>If you can read this in an inbox, delivery is configured correctly.</p>",
  ].join(""),
});

console.log("send() result:", result);
