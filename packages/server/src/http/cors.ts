import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

/**
 * Permissive CORS for API consumers on any origin.
 *
 * JSON APIs are normally called by the bundled frontend, which is same-origin
 * through the Vite/reverse proxy. This policy exists so a browser app hosted
 * anywhere, or a tool calling the API directly, is never blocked by CORS.
 *
 * Origins are reflected instead of `*` because session cookies are sent with
 * credentials, and browsers reject `Access-Control-Allow-Origin: *` in that
 * mode. API routes still authenticate every request; CORS is not access
 * control. Cross-site cookies additionally need SameSite=None and HTTPS, which
 * is a deployment choice in Better Auth.
 */
export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "accept",
      "authorization",
      "content-type",
      "x-requested-with",
      "x-csrf-token",
    ],
    exposedHeaders: ["content-disposition", "content-length", "etag"],
    maxAge: 86_400,
  });
}
