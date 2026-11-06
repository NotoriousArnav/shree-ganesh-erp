import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../auth.js";

/**
 * Bridges Fastify to Better Auth's Fetch-style handler.
 *
 * Better Auth owns everything under /api/auth: sign-in, sign-out, session,
 * phone-number and admin endpoints.
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(
          request.url,
          `http://${request.headers.host ?? "localhost"}`,
        );
        const headers = fromNodeHeaders(request.headers);
        const body =
          request.method !== "GET" && request.body !== undefined
            ? JSON.stringify(request.body)
            : undefined;

        const authRequest = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(body ? { body } : {}),
        });

        const response = await auth.handler(authRequest);

        reply.status(response.status);

        const setCookies = response.headers.getSetCookie?.() ?? [];
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === "set-cookie") return;
          reply.header(key, value);
        });
        if (setCookies.length > 0) {
          reply.header("set-cookie", setCookies);
        }

        return reply.send(await response.text());
      } catch (error) {
        app.log.error({ err: error }, "authentication handler failed");
        return reply
          .code(500)
          .send({ error: "Internal authentication error" });
      }
    },
  });
}
