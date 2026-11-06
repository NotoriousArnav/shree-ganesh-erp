import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { sql } from "drizzle-orm";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { client, db } from "./db.js";
import { createMcpServer } from "./mcp.js";
import { openapiSpec } from "./openapi.js";
import { registerAdminRoutes } from "./routes/admin-routes.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerInventoryRoutes } from "./routes/inventory-routes.js";

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

app.get("/openapi.json", async () => openapiSpec);

await registerAuthRoutes(app);
await registerAdminRoutes(app);
await registerInventoryRoutes(app);

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
  await client.end({ timeout: 5 });
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port, host });
