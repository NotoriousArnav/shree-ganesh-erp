import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@ganesh/db";
import { merchants, staffPermissionValues, users } from "@ganesh/db/schema";
import { allStaffPermissions, requireRole } from "@ganesh/server/http/auth-guard";
import { isUniqueViolation } from "@ganesh/server/http/pg-errors";
import { provisionMerchantAccount } from "./staff-routes.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  const platformRoles = requireRole("super_admin", "dev");

  app.get("/api/admin/merchants", { preHandler: platformRoles }, async () => {
    return db.select().from(merchants).orderBy(desc(merchants.name));
  });

  app.get("/api/admin/users", { preHandler: platformRoles }, async () => {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneNumber: users.phoneNumber,
        role: users.role,
        merchantId: users.merchantId,
        banned: users.banned,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy((u) => u.createdAt);
  });

  app.post(
    "/api/admin/merchants",
    { preHandler: platformRoles },
    async (request, reply) => {
      const merchantInput = z.object({
        name: z.string().trim().min(1, "Name is required").max(120),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .max(60)
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Slug must use lowercase letters, numbers and dashes",
          )
          .optional(),
        gstin: z.string().trim().max(20).nullish(),
        phone: z.string().trim().max(24).nullish(),
        currency: z.string().trim().max(8).default("INR"),
        address: z.record(z.string(), z.string()).nullish(),
      });

      const input = merchantInput.safeParse(request.body);
      if (!input.success) {
        const issue = input.error.issues[0];
        const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
        return reply.code(400).send({ error: `${path}${issue?.message ?? "Invalid request"}` });
      }

      const slug = input.data.slug ?? slugifyMerchant(input.data.name);

      try {
        const [created] = await db
          .insert(merchants)
          .values({
            name: input.data.name,
            slug,
            gstin: input.data.gstin ?? null,
            phone: input.data.phone ?? null,
            currency: input.data.currency,
            address: input.data.address ?? null,
          })
          .returning();

        return reply.code(201).send(created);
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({ error: "A merchant with that slug already exists" });
        }
        throw error;
      }
    },
  );

  app.patch<{ Params: { merchantId: string } }>(
    "/api/admin/merchants/:merchantId",
    { preHandler: platformRoles },
    async (request, reply) => {
      const merchantId = request.params.merchantId;
      const input = z
        .object({
          name: z.string().trim().min(1, "Name is required").max(120).optional(),
          slug: z.string().trim().toLowerCase().max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers and dashes").optional(),
          gstin: z.string().trim().max(20).nullish(),
          phone: z.string().trim().max(24).nullish(),
          currency: z.string().trim().max(8).optional(),
          address: z.record(z.string(), z.string()).nullish(),
        })
        .partial()
        .superRefine((value, ctx) => {
          if (Object.keys(value).length === 0) ctx.addIssue({ code: "custom", message: "No changes supplied" });
        });

      const parsed = input.safeParse(request.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
        return reply.code(400).send({ error: `${path}${issue?.message ?? "Invalid request"}` });
      }

      const patch: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) patch.name = parsed.data.name;
      if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
      if (parsed.data.gstin !== undefined) patch.gstin = parsed.data.gstin;
      if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
      if (parsed.data.currency !== undefined) patch.currency = parsed.data.currency;
      if (parsed.data.address !== undefined) patch.address = parsed.data.address;

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: "No changes supplied" });
      }

      const [updated] = await db
        .update(merchants)
        .set(patch)
        .where(eq(merchants.id, merchantId))
        .returning();

      if (!updated) return reply.code(404).send({ error: "Merchant not found" });

      return updated;
    },
  );

  app.post<{ Params: { merchantId: string } }>(
    "/api/admin/merchants/:merchantId/users",
    { preHandler: platformRoles },
    async (request, reply) => {
      const merchantId = request.params.merchantId;
      const [merchant] = await db
        .select({ id: merchants.id })
        .from(merchants)
        .where(eq(merchants.id, merchantId))
        .limit(1);

      if (!merchant) return reply.code(404).send({ error: "Merchant not found" });

      const merchantUserInput = z.object({
        name: z.string().trim().min(1, "Name is required").max(120),
        email: z
          .string()
          .trim()
          .max(160)
          .pipe(z.email("Enter a valid email address")),
        password: z
          .string()
          .min(8, "Use at least 8 characters")
          .max(128, "Use 128 characters or fewer"),
        phoneNumber: z
          .string()
          .trim()
          .max(24)
          .nullish()
          .transform((value) =>
            value === undefined || value === null ? null : value.replace(/[^\d+]/g, ""),
          ),
        permissions: z
          .array(z.enum(staffPermissionValues))
          .max(staffPermissionValues.length)
          .optional(),
      });

      const input = merchantUserInput.safeParse(request.body);
      if (!input.success) {
        const issue = input.error.issues[0];
        const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
        return reply.code(400).send({ error: `${path}${issue?.message ?? "Invalid request"}` });
      }

      const user = await provisionMerchantAccount({
        merchantId,
        name: input.data.name,
        email: input.data.email.toLowerCase(),
        password: input.data.password,
        phoneNumber: input.data.phoneNumber,
        permissions: input.data.permissions ?? [...allStaffPermissions],
        role: "merchant",
      });

      if (!user) return reply.code(500).send({ error: "Could not create user" });

      return reply.code(201).send(user);
    },
  );
}

function slugifyMerchant(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "merchant";
}
