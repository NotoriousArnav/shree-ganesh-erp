import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { sql } from "drizzle-orm";

import { client, db } from "@ganesh/db";
import { registerAuthRoutes } from "@ganesh/server/routes/auth-routes";
import { closeMailer } from "@ganesh/server/mail";

import { openapiSpec } from "./openapi.js";
import { registerInvoiceRoutes } from "./routes/invoice-routes.js";

const app = Fastify({ logger: true });

app.register(swagger, { openapi: openapiSpec });
app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/health", async () => ({ status: "ok", app: "lokkhi" }));

app.get("/health/db", async (_request, reply) => {
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", database: "connected" };
  } catch (error) {
    app.log.error({ err: error }, "database health check failed");
    return reply
      .code(503)
      .send({ status: "error", database: "disconnected" });
  }
});

app.get("/openapi.json", async () => openapiSpec);

await registerAuthRoutes(app);
await registerInvoiceRoutes(app);

const port = Number(process.env.PORT ?? 8081);
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
