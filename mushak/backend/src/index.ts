import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createMcpServer } from "./mcp.js";
import { openapiSpec } from "./openapi.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

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

app.get("/openapi.json", async () => openapiSpec);

app.post("/mcp", async (req, reply) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer();
  await server.connect(transport);

  return reply;
});

await app.listen({
  port: 8080,
  host: "0.0.0.0",
});
