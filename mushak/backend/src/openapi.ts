export const openapiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Mushak API",
    version: "0.0.0",
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK",
          },
        },
      },
    },
    "/health/db": {
      get: {
        summary: "Database health check",
        responses: {
          "200": {
            description: "Database is reachable",
          },
          "503": {
            description: "Database is unreachable",
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        summary: "OpenAPI document",
        responses: {
          "200": {
            description: "OpenAPI specification",
          },
        },
      },
    },
    "/mcp": {
      post: {
        summary: "Model Context Protocol endpoint",
        responses: {
          "200": {
            description: "MCP response",
          },
        },
      },
    },
  },
};
