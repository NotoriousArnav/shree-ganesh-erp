import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";

import { auth } from "../auth.js";
import { db } from "../db.js";
import {
  staffPermissionValues,
  users,
  type StaffPermission,
  type UserRole,
} from "../db/schema.js";

/** Every permission, in the order the UI shows them. */
export const allStaffPermissions: StaffPermission[] = [...staffPermissionValues];

export type MerchantAccess = {
  userId: string;
  role: "merchant" | "staff";
  merchantId: string;
  permissions: StaffPermission[];
};

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

/** Drops unknown values so a hand-edited row cannot grant something odd. */
export function normalizePermissions(value: unknown): StaffPermission[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<StaffPermission>();

  for (const entry of value) {
    if (
      typeof entry === "string" &&
      (staffPermissionValues as readonly string[]).includes(entry)
    ) {
      seen.add(entry as StaffPermission);
    }
  }

  return allStaffPermissions.filter((permission) => seen.has(permission));
}

/**
 * Reads the caller's shop access from the database.
 *
 * The session alone is not enough: a merchant may demote or deactivate a staff
 * account while its old session is still in the cookie. Reading the row makes
 * permission and ban changes take effect immediately.
 *
 * Returns null after sending a 401/403 reply.
 */
async function resolveMerchantAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<MerchantAccess | null> {
  const session = await getSession(request);

  if (!session) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }

  const [user] = await db
    .select({
      role: users.role,
      merchantId: users.merchantId,
      banned: users.banned,
      staffPermissions: users.staffPermissions,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }

  if (user.role !== "merchant" && user.role !== "staff") {
    reply.code(403).send({ error: "Forbidden" });
    return null;
  }

  if (user.banned) {
    reply
      .code(403)
      .send({ error: "This account has been deactivated. Ask the shop owner." });
    return null;
  }

  if (!user.merchantId) {
    reply.code(403).send({ error: "Account is not linked to a merchant" });
    return null;
  }

  const access: MerchantAccess = {
    userId: session.user.id,
    role: user.role,
    merchantId: user.merchantId,
    permissions:
      user.role === "merchant"
        ? allStaffPermissions
        : normalizePermissions(user.staffPermissions),
  };

  request.merchantAccess = access;
  return access;
}

/**
 * Fastify preHandler factory.
 *
 * Merchant-scoped roles must also be linked to a merchant and must not be
 * deactivated; a half-provisioned account is denied instead of silently
 * seeing another tenant's data.
 */
export function requireMerchant() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await resolveMerchantAccess(request, reply);
  };
}

/**
 * Requires one or more staff permissions.
 *
 * Merchants always pass. Staff pass only when their saved permissions include
 * every requested value.
 */
export function requirePermission(...needed: StaffPermission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const access = await resolveMerchantAccess(request, reply);
    if (!access) return;

    const missing = needed.filter(
      (permission) => !access.permissions.includes(permission),
    );

    if (missing.length > 0) {
      reply.code(403).send({
        error:
          missing.length === 1
            ? `You do not have permission to change ${permissionLabel(missing[0])}.`
            : `You do not have permission to change ${missing
                .map(permissionLabel)
                .join(", ")}.`,
      });
    }
  };
}

/** True when the caller (already checked by a guard) may do this. */
export function can(request: FastifyRequest, permission: StaffPermission) {
  return request.merchantAccess?.permissions.includes(permission) ?? false;
}

function permissionLabel(permission: StaffPermission) {
  switch (permission) {
    case "stock":
      return "stock";
    case "catalogue":
      return "the catalogue";
    case "categories":
      return "categories";
  }
}

/**
 * Requires the shop owner. Staff can never manage other staff accounts, even
 * if they have every other permission.
 */
export function requireOwner() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const access = await resolveMerchantAccess(request, reply);
    if (!access) return;

    if (access.role !== "merchant") {
      reply.code(403).send({ error: "Only the shop owner can manage staff." });
    }
  };
}

/**
 * Fastify preHandler factory for platform roles.
 *
 * Used by the admin API; shop users go through requireMerchant instead.
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

declare module "fastify" {
  interface FastifyRequest {
    merchantAccess?: MerchantAccess;
  }
}
