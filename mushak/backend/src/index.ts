import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { sql } from "drizzle-orm";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { client, db } from "@ganesh/db";
import { closeMailer } from "@ganesh/server/mail";
import { createMcpServer } from "./mcp.js";
import { openapiSpec } from "./openapi.js";
import { registerAdminRoutes } from "./routes/admin-routes.js";
import { registerAuthRoutes } from "@ganesh/server/routes/auth-routes";
import { registerMerchantRoutes } from "./routes/merchant-routes.js";
import { registerStaffRoutes } from "./routes/staff-routes.js";
import { registerStorageRoutes } from "./routes/storage-routes.js";
import { getStorage, isStorageConfigured } from "./storage/index.js";

const app = Fastify({
  logger: true,
});

app.register(swagger, {
  openapi: openapiSpec,
});

app.register(swaggerUi, {
  routePrefix: "/docs",
});

app.get("/health", async () => ({
  status: "ok",
}));

app.get("/health/db", async (_request, reply) => {
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", database: "connected" };
  } catch (error) {
    app.log.error({ err: error }, "database health check failed");
    return reply
      .status(503)
      .send({ status: "error", database: "disconnected" });
  }
});

app.get("/health/storage", async (_request, reply) => {
  if (!isStorageConfigured()) {
    return reply
      .code(503)
      .send({ status: "unconfigured", storage: "not configured" });
  }

  try {
    const reachable = await getStorage().check();
    if (!reachable) {
      return reply
        .code(503)
        .send({ status: "error", storage: "unreachable" });
    }
    return { status: "ok", storage: "connected" };
  } catch (error) {
    app.log.error({ err: error }, "storage health check failed");
    return reply.code(503).send({ status: "error", storage: "unreachable" });
  }
});

app.get("/openapi.json", async () => openapiSpec);

await registerAuthRoutes(app);
await registerAdminRoutes(app);
await registerMerchantRoutes(app);
await registerStaffRoutes(app);
await registerStorageRoutes(app);

app.post("/mcp", async (req, reply) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer();
  await server.connect(transport);

  return reply;
});

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
