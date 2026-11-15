import "dotenv/config";
import "./env.js";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import { sql } from "drizzle-orm";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { db } from "@ganesh/db";
import { registerCors } from "@ganesh/server/http/cors";
import { createMcpServer } from "./mcp.js";
import { openapiSpec } from "./openapi.js";
import { registerAdminRoutes } from "./routes/admin-routes.js";
import { registerAuthRoutes } from "@ganesh/server/routes/auth-routes";
import { registerMerchantRoutes } from "./routes/merchant-routes.js";
import { registerStaffRoutes } from "./routes/staff-routes.js";
import { registerStorageRoutes } from "./routes/storage-routes.js";
import { getStorage, isStorageConfigured } from "./storage/index.js";

/**
 * The Fastify instance without a listening socket.
 *
 * Vercel's Fastify runtime imports the first entry it finds among `app`,
 * `index`, `server`, `src/app`, `src/index` and `src/server`, and serves it
 * itself. Keeping the app export separate from `index.ts` lets the same routes
 * run under `node dist/index.js` and under the Vercel runtime.
 *
 * The module format is ES modules (`.mts`), which Vercel deploys as `.mjs` so
 * Node loads it with the right parser. Registration therefore happens inside a
 * plugin instead of with top-level `await`: CommonJS `require()` cannot load a
 * module that awaits at the top level, and Vercel's launcher uses `require()`.
 */
console.log("[boot] module imported");

const app = Fastify({
  logger: true,
});

// Vercel kills an invocation that never becomes ready without leaving a trace,
// so fail loudly instead of hanging until the platform times out.
const bootWatchdog = setTimeout(() => {
  console.error("[boot] app did not become ready within 10s");
  process.exit(1);
}, 10_000);
bootWatchdog.unref();

app.addHook("onReady", () => {
  clearTimeout(bootWatchdog);
  console.log("[boot] app ready");
});

app.register(async (instance) => {
  console.log("[boot] registering swagger");
  await instance.register(swagger, {
    openapi: openapiSpec,
  });

  // @fastify/swagger-ui pulls in @fastify/static, whose content-disposition
  // dependency is ESM-only. Vercel's Node runtime disables require(ESM), so the
  // UI crashes there while the JSON spec keeps working. Skip the UI on Vercel,
  // and import it dynamically so the module is not even loaded there.
  if (!process.env.VERCEL) {
    const { default: swaggerUi } = await import("@fastify/swagger-ui");
    await instance.register(swaggerUi, {
      routePrefix: "/docs",
    });
  }

  console.log("[boot] registering cors");
  await registerCors(instance);

  instance.get("/health", async () => ({
    status: "ok",
  }));

  instance.get("/health/db", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: "ok", database: "connected" };
    } catch (error) {
      instance.log.error({ err: error }, "database health check failed");
      return reply
        .status(503)
        .send({ status: "error", database: "disconnected" });
    }
  });

  instance.get("/health/storage", async (_request, reply) => {
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
      instance.log.error({ err: error }, "storage health check failed");
      return reply.code(503).send({ status: "error", storage: "unreachable" });
    }
  });

  instance.get("/openapi.json", async () => openapiSpec);

  console.log("[boot] registering routes");
  await registerAuthRoutes(instance);
  await registerAdminRoutes(instance);
  await registerMerchantRoutes(instance);
  await registerStaffRoutes(instance);
  await registerStorageRoutes(instance);
  console.log("[boot] routes registered");

  instance.post("/mcp", async (req, reply) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServer();
    await server.connect(transport);

    return reply;
  });
});

export { app };
export default app;
