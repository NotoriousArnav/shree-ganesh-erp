import "dotenv/config";

import { getMailer } from "../mail/index.js";

const to = process.argv[2] ?? "test@mushak.local";

const result = await getMailer().send({
  to,
  subject: "Mushak mailer test · नमस्ते",
  text: [
    "Hello from the Mushak console mailer.",
    "",
    "This message was printed to the terminal and saved as .eml and .json",
    "under the mail directory (default /tmp/mushak-mail).",
  ].join("\n"),
  html: [
    "<h1>Mushak mailer</h1>",
    "<p>Hello from the <strong>console transport</strong>.</p>",
    "<p>This is the HTML alternative.</p>",
  ].join(""),
});

console.log("send() result:", result);
