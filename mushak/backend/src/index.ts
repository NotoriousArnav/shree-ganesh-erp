import { app } from "./app.mjs";
import { client } from "@ganesh/db";
import { closeMailer } from "@ganesh/server/mail";

/**
 * Local and container entrypoint. Vercel imports `app.ts` directly and
 * serves it without a listening socket, so this file is never used there.
 */
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

const shutdown = async () => {
  await app.close();
  closeMailer();
  await client.end({ timeout: 5 });
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port, host });
