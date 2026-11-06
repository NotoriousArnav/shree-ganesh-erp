import type { OpenAPIV3 } from "openapi-types";

export const openapiSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "Mushak API",
    version: "0.1.0",
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey" as const,
        in: "cookie" as const,
        name: "better-auth.session_token",
      },
    },
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
    "/api/auth/sign-in/email": {
      post: {
        summary: "Sign in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Session created" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/sign-in/phone-number": {
      post: {
        summary: "Sign in with phone number and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phoneNumber", "password"],
                properties: {
                  phoneNumber: { type: "string", example: "+919876543210" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Session created" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/get-session": {
      get: {
        summary: "Current session",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Session and user, or null" },
        },
      },
    },
    "/api/auth/sign-out": {
      post: {
        summary: "Sign out",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Session cleared" },
        },
      },
    },
    "/api/admin/merchants": {
      get: {
        summary: "List merchants",
        description: "Requires the super_admin or dev role.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Merchants" },
          "401": { description: "Not signed in" },
          "403": { description: "Not a platform role" },
        },
      },
    },
    "/api/admin/users": {
      get: {
        summary: "List users",
        description: "Requires the super_admin or dev role.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Users" },
          "401": { description: "Not signed in" },
          "403": { description: "Not a platform role" },
        },
      },
    },
    "/api/inventory/products": {
      get: {
        summary: "List products for the signed-in merchant",
        description:
          "Requires merchant or staff. The merchant is taken from the session, never from the request.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Products" },
          "401": { description: "Not signed in" },
          "403": { description: "Not a merchant-scoped role" },
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
