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
      post: {
        summary: "Create a merchant",
        description:
          "Requires the super_admin or dev role. Creates a shop; a starter owner can then be added via /api/admin/merchants/{id}/users.",
        security: [{ sessionCookie: [] }],
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid body" },
          "401": { description: "Not signed in" },
          "403": { description: "Not a platform role" },
          "409": { description: "Slug already in use" },
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
    "/api/admin/merchants/{merchantId}/users": {
      post: {
        summary: "Create a merchant-scoped user",
        description:
          "Requires the super_admin or dev role. Creates a merchant account with a credential login and the full permission set by default (owner).",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "merchantId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid body" },
          "401": { description: "Not signed in" },
          "403": { description: "Not a platform role" },
          "404": { description: "Merchant not found" },
          "409": { description: "Email or phone already in use" },
        },
      },
    },
    "/api/merchant/profile": {
      get: {
        summary: "Signed-in merchant and user",
        description:
          "Requires merchant or staff. The merchant comes from the session. user.permissions lists the effective staff permissions; merchants always have all of them.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Merchant and user" },
          "401": { description: "Not signed in" },
          "403": { description: "Not a merchant-scoped role" },
        },
      },
    },
    "/api/merchant/dashboard": {
      get: {
        summary: "Shop dashboard summary",
        description:
          "Counts, stock value, today's movements, low-stock products and recent stock movements.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Dashboard" },
          "401": { description: "Not signed in" },
          "403": { description: "Not a merchant-scoped role" },
        },
      },
    },
    "/api/merchant/categories": {
      get: {
        summary: "List categories",
        security: [{ sessionCookie: [] }],
        responses: { "200": { description: "Categories with product counts" } },
      },
      post: {
        summary: "Create a category",
        description:
          "Requires the merchant role or a staff account with the categories permission.",
        security: [{ sessionCookie: [] }],
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid body or parent category" },
          "409": { description: "Duplicate name" },
        },
      },
    },
    "/api/merchant/categories/{id}": {
      patch: {
        summary: "Rename a category",
        description:
          "Requires the merchant role or a staff account with the categories permission.",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Updated" },
          "404": { description: "Not found" },
          "409": { description: "Duplicate name" },
        },
      },
      delete: {
        summary: "Delete a category",
        description:
          "Requires the merchant role or the categories permission. Products keep existing and become uncategorised.",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/merchant/products": {
      get: {
        summary: "List products",
        description:
          "Query: q (name/SKU/barcode), categoryId, lowStock=true, includeInactive=true.",
        security: [{ sessionCookie: [] }],
        responses: { "200": { description: "Products with category names" } },
      },
      post: {
        summary: "Create a product",
        description:
          "Requires the merchant role or the catalogue permission. Opening stock is recorded as an adjustment movement and additionally needs the stock permission. Send categoryName to reuse or create a category inline; creating a new one needs the categories permission. When sku is empty a readable one is generated from the name; barcode is optional.",
        security: [{ sessionCookie: [] }],
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid body or category" },
          "409": { description: "Duplicate SKU or barcode" },
        },
      },
    },
    "/api/merchant/products/{id}": {
      patch: {
        summary: "Update a product",
        description:
          "Requires the merchant role or the catalogue permission. Stock is not editable here; use the stock endpoint. categoryName reuses an existing category, and only creates one with the categories permission; an empty value clears it.",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Updated" },
          "400": { description: "Invalid body" },
          "404": { description: "Not found" },
          "409": { description: "Duplicate SKU or barcode" },
        },
      },
      delete: {
        summary: "Archive a product",
        description:
          "Soft delete: sets isActive=false and keeps stock history. Requires the merchant role or the catalogue permission.",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Archived" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/merchant/products/{id}/stock": {
      post: {
        summary: "Move stock",
        description:
          "Requires the merchant role or a staff account with the stock permission. Types: purchase, sale, return_in, return_out, damage, adjustment, transfer_in, transfer_out. Quantity is positive; the type decides the sign. Adjustment requires direction=in|out.",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Updated product and movement" },
          "400": { description: "Invalid body or insufficient stock" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/merchant/products/{id}/movements": {
      get: {
        summary: "Stock history for one product",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Product and movements" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/merchant/movements": {
      get: {
        summary: "Recent stock movements",
        description: "Query: limit (1-200, default 50).",
        security: [{ sessionCookie: [] }],
        responses: { "200": { description: "Movements with product names" } },
      },
    },
    "/api/merchant/staff": {
      get: {
        summary: "List staff",
        description: "Requires the merchant role. Returns staff for the merchant on the session.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": { description: "Staff accounts with permissions and active status" },
          "401": { description: "Not signed in" },
          "403": { description: "Not the shop owner" },
        },
      },
      post: {
        summary: "Create a staff account",
        description:
          "Requires the merchant role. Password must be 8-128 characters. Permissions are stock, catalogue and categories; the default is stock only.",
        security: [{ sessionCookie: [] }],
        responses: {
          "201": { description: "Created" },
          "400": { description: "Invalid body" },
          "403": { description: "Not the shop owner" },
          "409": { description: "Email or phone already in use" },
        },
      },
    },
    "/api/merchant/staff/{id}": {
      patch: {
        summary: "Update staff details or access",
        description:
          "Requires the merchant role. Send name, phoneNumber, permissions or active. active=false deactivates the account, signs out every device and blocks sign-in.",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Updated" },
          "400": { description: "Invalid body" },
          "403": { description: "Not the shop owner" },
          "404": { description: "Not found for this shop" },
          "409": { description: "Phone already in use" },
        },
      },
    },
    "/api/merchant/staff/{id}/password": {
      post: {
        summary: "Reset a staff password",
        description:
          "Requires the merchant role. The account is signed out everywhere after the change.",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Password changed" },
          "400": { description: "Invalid body" },
          "403": { description: "Not the shop owner" },
          "404": { description: "Not found for this shop" },
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
