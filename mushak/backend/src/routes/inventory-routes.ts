import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";

import { db } from "../db.js";
import { products } from "../db/schema.js";
import { requireRole } from "../http/auth-guard.js";

export async function registerInventoryRoutes(app: FastifyInstance) {
  app.get(
    "/api/inventory/products",
    { preHandler: requireRole("merchant", "staff") },
    async (request) => {
      const merchantId = request.authSession!.user.merchantId!;

      return db
        .select()
        .from(products)
        .where(eq(products.merchantId, merchantId))
        .orderBy(products.name);
    },
  );
}
