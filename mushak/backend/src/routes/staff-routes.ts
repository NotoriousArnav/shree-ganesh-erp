import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "../auth.js";
import { db } from "../db.js";
import {
  staffPermissionValues,
  users,
  type StaffPermission,
} from "../db/schema.js";
import {
  normalizePermissions,
  requireOwner,
  type MerchantAccess,
} from "../http/auth-guard.js";
import {
  isUniqueViolation,
  uniqueConstraint,
} from "../http/pg-errors.js";

/**
 * Staff management for merchants.
 *
 * A merchant can create counter accounts, choose what each may change, reset
 * a password and deactivate an account. Staff can never reach these routes,
 * and every query is scoped to the merchant on the session.
 */

const permissionList = z
  .array(z.enum(staffPermissionValues))
  .max(staffPermissionValues.length)
  .default(["stock"]);

/** Update shape: only apply when the key is actually sent. */
const updatePermissionList = z
  .array(z.enum(staffPermissionValues))
  .max(staffPermissionValues.length)
  .optional();

/**
 * Accepts 9876543210, +919876543210, or a spaced version of either; stores the
 * same normalized value the sign-in screen sends.
 */
function normalizePhone(value: string) {
  const cleaned = value.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
}

const phoneField = z
  .string()
  .trim()
  .max(24)
  .nullish()
  .transform((value) =>
    value === undefined || value === null ? value : normalizePhone(value),
  )
  .refine(
    (value) =>
      value === undefined ||
      value === null ||
      (typeof value === "string" && /^\+?\d{7,15}$/.test(value)),
    { message: "Enter a valid phone number" },
  );

const staffCreateInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .max(160)
    .pipe(z.email("Enter a valid email address")),
  phoneNumber: phoneField,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Use 128 characters or fewer"),
  permissions: permissionList,
});

const staffUpdateInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120).optional(),
    phoneNumber: phoneField,
    permissions: updatePermissionList,
    /** false deactivates the account and signs it out everywhere. */
    active: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.phoneNumber !== undefined ||
      value.permissions !== undefined ||
      value.active !== undefined,
    { message: "No changes supplied" },
  );

const passwordInput = z.object({
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Use 128 characters or fewer"),
});

function parse<T>(schema: z.ZodType<T>, data: unknown, reply: FastifyReply) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    reply
      .code(400)
      .send({ error: `${path}${issue?.message ?? "Invalid request"}` });
    return null;
  }
  return result.data;
}

function merchantIdOf(request: FastifyRequest) {
  return (request as FastifyRequest & { merchantAccess: MerchantAccess })
    .merchantAccess.merchantId;
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "Staff member not found" });
}

function duplicateMessage(error: unknown) {
  const constraint = uniqueConstraint(error);

  if (constraint === "users_email_idx") {
    return "Another account already uses that email address.";
  }

  if (constraint === "users_phone_number_idx") {
    return "Another account already uses that phone number.";
  }

  return "That email or phone number is already in use.";
}

/** Finds a staff row inside this merchant, never another tenant's. */
async function findStaff(merchantId: string, id: string) {
  const [staff] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phoneNumber: users.phoneNumber,
      permissions: users.staffPermissions,
      banned: users.banned,
      role: users.role,
      merchantId: users.merchantId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.id, id),
        eq(users.merchantId, merchantId),
        eq(users.role, "staff"),
      ),
    )
    .limit(1);

  return staff ?? null;
}

function serialize(staff: {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  permissions: unknown;
  banned: boolean | null;
  createdAt: Date;
}) {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    phoneNumber: staff.phoneNumber,
    permissions: normalizePermissions(staff.permissions),
    active: !staff.banned,
    createdAt: staff.createdAt,
  };
}

/** The merchant user row behind a provisioning result. */
export type ProvisionedUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  permissions: StaffPermission[];
  banned: boolean | null;
  merchantId: string | null;
  role: string;
};

/**
 * Creates a credential user for a merchant with a chosen permission set.
 * Used by both the merchant staff flow and the admin provisioning flow.
 */
export async function provisionMerchantAccount(input: {
  merchantId: string;
  name: string;
  email: string;
  password: string;
  phoneNumber: string | null;
  permissions: StaffPermission[];
  role: "merchant" | "staff";
}): Promise<{
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  permissions: StaffPermission[];
  active: boolean;
  createdAt: Date;
} | null> {
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(input.password);

  const created = await ctx.internalAdapter.createUser(
    {
      name: input.name,
      email: input.email.toLowerCase(),
      emailVerified: false,
      role: input.role,
      merchantId: input.merchantId,
      phoneNumber: input.phoneNumber,
      phoneNumberVerified: false,
      banned: false,
      staffPermissions: input.permissions,
    },
    { method: "admin" },
  );

  try {
    await ctx.internalAdapter.linkAccount({
      providerId: "credential",
      accountId: created.id,
      userId: created.id,
      password: passwordHash,
    });
  } catch (error) {
    // Do not leave a user who can never sign in.
    await ctx.internalAdapter.deleteUser(created.id);
    throw error;
  }

  // Better Auth only knows its own user fields, so the permission list has to
  // be written back explicitly.
  await db
    .update(users)
    .set({ staffPermissions: input.permissions })
    .where(eq(users.id, created.id));

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phoneNumber: users.phoneNumber,
      permissions: users.staffPermissions,
      banned: users.banned,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, created.id), eq(users.merchantId, input.merchantId)))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    permissions: normalizePermissions(user.permissions) as StaffPermission[],
    active: !user.banned,
    createdAt: user.createdAt,
  };
}

export async function registerStaffRoutes(app: FastifyInstance) {
  const owner = requireOwner();

  app.get("/api/merchant/staff", { preHandler: owner }, async (request) => {
    const merchantId = merchantIdOf(request);

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneNumber: users.phoneNumber,
        permissions: users.staffPermissions,
        banned: users.banned,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(eq(users.merchantId, merchantId), eq(users.role, "staff")),
      )
      .orderBy(asc(users.name));

    return rows.map(serialize);
  });

  app.post(
    "/api/merchant/staff",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(staffCreateInput, request.body, reply);
      if (!input) return;

      try {
        const staff = await provisionMerchantAccount({
          merchantId,
          name: input.name,
          email: input.email.toLowerCase(),
          password: input.password,
          phoneNumber: input.phoneNumber ?? null,
          permissions: input.permissions,
          role: "staff",
        });

        if (!staff) return reply.code(500).send({ error: "Could not create staff" });

        return reply.code(201).send(staff);
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({ error: duplicateMessage(error) });
        }
        throw error;
      }
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/merchant/staff/:id",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(staffUpdateInput, request.body, reply);
      if (!input) return;

      const staff = await findStaff(merchantId, request.params.id);
      if (!staff) return notFound(reply);

      const patch: Record<string, unknown> = {};

      if (input.name !== undefined) patch.name = input.name;
      if (input.phoneNumber !== undefined) {
        patch.phoneNumber = input.phoneNumber;
      }
      if (input.permissions !== undefined) {
        patch.staffPermissions = input.permissions;
      }
      if (input.active !== undefined) {
        patch.banned = !input.active;
        patch.banReason = input.active ? null : "Deactivated by shop owner";
        patch.banExpires = null;
      }

      try {
        await db
          .update(users)
          .set(patch)
          .where(and(eq(users.id, staff.id), eq(users.merchantId, merchantId)));
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({ error: duplicateMessage(error) });
        }
        throw error;
      }

      if (input.active === false) {
        const ctx = await auth.$context;
        await ctx.internalAdapter.deleteUserSessions(staff.id);
      }

      const updated = await findStaff(merchantId, staff.id);
      if (!updated) return notFound(reply);

      return serialize(updated);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/merchant/staff/:id/password",
    { preHandler: owner },
    async (request, reply) => {
      const merchantId = merchantIdOf(request);
      const input = parse(passwordInput, request.body, reply);
      if (!input) return;

      const staff = await findStaff(merchantId, request.params.id);
      if (!staff) return notFound(reply);

      const ctx = await auth.$context;
      const password = await ctx.password.hash(input.password);
      const account = await ctx.internalAdapter.findCredentialAccount(staff.id);

      if (account) {
        await ctx.internalAdapter.updateAccount(account.id, { password });
      } else {
        await ctx.internalAdapter.linkAccount({
          providerId: "credential",
          accountId: staff.id,
          userId: staff.id,
          password,
        });
      }

      // A new password should not leave old devices signed in.
      await ctx.internalAdapter.deleteUserSessions(staff.id);

      return { id: staff.id, passwordReset: true };
    },
  );
}
