import "dotenv/config";
import { eq } from "drizzle-orm";

import { db, client } from "@ganesh/db";
import { users } from "@ganesh/db/schema";

/**
 * Creates the first super admin, or repairs an existing account.
 *
 * Sign-up is disabled for the running server; enabling it for this one process
 * lets Better Auth create the credential account with a properly hashed
 * password.
 */
process.env.ALLOW_SIGNUP = "true";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Super Admin";

if (!email || !password) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD in mushak/backend/.env before seeding.",
  );
  process.exit(1);
}

const { auth } = await import("@ganesh/server/auth");

const existing = await db
  .select({ id: users.id, role: users.role })
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (existing.length > 0) {
  await db
    .update(users)
    .set({ role: "super_admin", merchantId: null, banned: false })
    .where(eq(users.id, existing[0].id));
  console.log(`Super admin already exists for ${email}; role verified.`);
} else {
  await auth.api.signUpEmail({
    body: { email, password, name },
  });
  await db
    .update(users)
    .set({ role: "super_admin", merchantId: null, emailVerified: true })
    .where(eq(users.email, email));
  console.log(`Created super admin ${email}.`);
}

await client.end();
