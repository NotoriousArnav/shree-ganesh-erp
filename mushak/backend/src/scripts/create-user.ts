import "dotenv/config";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";

import { db, client } from "@ganesh/db";
import { merchants, userRoleValues, users } from "@ganesh/db/schema";

/**
 * Provisions a user without the public sign-up endpoint.
 *
 * Usage:
 *   npm run user:create -- --email owner@shop.in --password secret123 \
 *     --name "Shop Owner" --role merchant --merchant ganesh-kirana
 *
 * Pass a merchant id or slug. Phone is optional and enables phone sign-in.
 */
process.env.ALLOW_SIGNUP = "true";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "staff" },
    merchant: { type: "string" },
    phone: { type: "string" },
  },
});

const email = values.email?.trim().toLowerCase();
const password = values.password;
const name = values.name?.trim() || "Mushak User";
const role = values.role ?? "staff";
const phone = values.phone?.trim();
const merchantRef = values.merchant?.trim();

if (!email || !password) {
  console.error(
    "Usage: npm run user:create -- --email <email> --password <password> [--name <name>] [--role super_admin|dev|merchant|staff] [--merchant <id-or-slug>] [--phone <e164>]",
  );
  process.exit(1);
}

if (!(userRoleValues as readonly string[]).includes(role)) {
  console.error(
    `Invalid role "${role}". Use one of: ${userRoleValues.join(", ")}`,
  );
  process.exit(1);
}

const merchantScoped = role === "merchant" || role === "staff";
let merchantId: string | null = null;

if (merchantScoped) {
  if (!merchantRef) {
    console.error(`--merchant is required for the ${role} role.`);
    process.exit(1);
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      merchantRef,
    );

  const [merchant] = isUuid
    ? await db
        .select()
        .from(merchants)
        .where(eq(merchants.id, merchantRef))
        .limit(1)
    : await db
        .select()
        .from(merchants)
        .where(eq(merchants.slug, merchantRef))
        .limit(1);

  if (!merchant) {
    console.error(`Merchant "${merchantRef}" not found.`);
    process.exit(1);
  }

  merchantId = merchant.id;
} else if (merchantRef) {
  console.error(`--merchant is only valid for merchant and staff roles.`);
  process.exit(1);
}

const { auth } = await import("@ganesh/server/auth");

const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (existing.length > 0) {
  await db
    .update(users)
    .set({
      name,
      role,
      merchantId,
      ...(phone ? { phoneNumber: phone } : {}),
      banned: false,
    })
    .where(eq(users.id, existing[0].id));
  console.log(`Updated existing user ${email} (${role}).`);
} else {
  try {
    await auth.api.signUpEmail({
      body: { email, password, name },
    });
  } catch (error) {
    console.error(
      "Could not create user:",
      error instanceof Error ? error.message : error,
    );
    await client.end();
    process.exit(1);
  }

  await db
    .update(users)
    .set({
      role,
      merchantId,
      ...(phone ? { phoneNumber: phone } : {}),
      emailVerified: true,
    })
    .where(eq(users.email, email));

  console.log(`Created user ${email} (${role}).`);
}

console.log(
  `Sign in at http://localhost:5173/login with ${email}${phone ? ` or ${phone}` : ""}.`,
);

await client.end();
