import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "mushak",
    version: "0.0.0",
  });

  server.tool("health_check", async () => ({
    content: [
      {
        type: "text",
        text: "ok",
      },
    ],
  }));

  return server;
}
