import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../auth.js";
import type { UserRole } from "../db/schema.js";

/**
 * Loads the Better Auth session from the request cookie and caches it on the
 * request object. Returns null when the caller is not signed in.
 */
export async function loadSession(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  request.authSession = session ?? null;
  return request.authSession;
}

export async function getSession(request: FastifyRequest) {
  return request.authSession ?? (await loadSession(request));
}

/**
 * Fastify preHandler factory.
 *
 * Merchant-scoped roles must also be linked to a merchant; a half-provisioned
 * account is denied instead of silently seeing another tenant's data.
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await getSession(request);

    if (!session) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const role = session.user.role as UserRole | undefined;

    if (!role || !roles.includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    if (
      (role === "merchant" || role === "staff") &&
      !session.user.merchantId
    ) {
      return reply
        .code(403)
        .send({ error: "Account is not linked to a merchant" });
    }
  };
}
