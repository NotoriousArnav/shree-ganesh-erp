import type { FastifyInstance } from "fastify";
import { desc } from "drizzle-orm";

import { db } from "../db.js";
import { merchants, users } from "../db/schema.js";
import { requireRole } from "../http/auth-guard.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  const platformRoles = requireRole("super_admin", "dev");

  app.get(
    "/api/admin/merchants",
    { preHandler: platformRoles },
    async () => {
      return db.select().from(merchants).orderBy(merchants.name);
    },
  );

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
      .orderBy(desc(users.createdAt));
  });
}
