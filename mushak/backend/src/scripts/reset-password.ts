import "dotenv/config";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";

import { db, client } from "../db.js";
import { users } from "../db/schema.js";

/**
 * Resets a password without sending mail.
 *
 * Usage:
 *   npm run user:reset-password -- --email admin@mushak.local --password new-secret
 *
 * Uses Better Auth's own hasher so the stored hash matches what the sign-in
 * endpoint expects. Existing sessions are revoked, like a mailed reset.
 */
const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
  },
});

const email = values.email?.trim().toLowerCase();
const password = values.password;

if (!email || !password) {
  console.error(
    "Usage: npm run user:reset-password -- --email <email> --password <password>",
  );
  process.exit(1);
}

if (password.length < 8 || password.length > 128) {
  console.error("Password must be between 8 and 128 characters.");
  process.exit(1);
}

const { auth } = await import("../auth.js");
const ctx = await auth.$context;

const found = await db
  .select({ id: users.id, email: users.email, role: users.role })
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (found.length === 0) {
  console.error(`No user with email ${email}.`);
  await client.end({ timeout: 5 });
  process.exit(1);
}

const user = found[0];
const hashed = await ctx.password.hash(password);
const existingAccount = await ctx.internalAdapter.findCredentialAccount(user.id);

if (existingAccount) {
  await ctx.internalAdapter.updatePassword(user.id, hashed);
} else {
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashed,
  });
}

await ctx.internalAdapter.deleteUserSessions(user.id);

console.log(
  `Password reset for ${user.email} (${user.role}); existing sessions revoked.`,
);

await client.end({ timeout: 5 });
process.exit(0);
