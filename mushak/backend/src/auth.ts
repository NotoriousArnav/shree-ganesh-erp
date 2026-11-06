import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, phoneNumber } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { networkInterfaces } from "node:os";

import { db } from "./db.js";
import * as schema from "./db/schema.js";
import { getMailer } from "./mail/index.js";
import { escapeHtml } from "./mail/mailer.js";

/**
 * Role definitions.
 *
 * - super_admin: platform owner, full admin API and impersonation.
 * - dev:         platform helper, user support without role changes.
 * - merchant:    shop owner, scoped to one merchant.
 * - staff:       shop employee, scoped to one merchant, no user management.
 *
 * Roles are stored on users.role and are normally changed directly in the
 * database (Drizzle Studio).
 */
const ac = createAccessControl(defaultStatements);

const superAdminRole = ac.newRole({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "set-email",
    "set-phone",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
});

const devRole = ac.newRole({
  user: ["list", "get", "update", "set-password", "set-phone"],
  session: ["list", "revoke"],
});

const merchantRole = ac.newRole({ user: [], session: [] });
const staffRole = ac.newRole({ user: [], session: [] });

/**
 * Origins allowed to call the auth API.
 *
 * `FRONTEND_URL` and `BETTER_AUTH_URL` cover the usual case, `TRUSTED_ORIGINS`
 * (comma-separated) covers extra deployments, and in development every LAN
 * address of this machine is added so a phone on the same Wi-Fi can sign in
 * without editing .env whenever the router hands out a new IP.
 */
function buildTrustedOrigins() {
  const frontend = new URL(process.env.FRONTEND_URL ?? "http://localhost:5173");
  const origins = new Set<string>([
    frontend.origin,
    new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:8080").origin,
  ]);

  for (const entry of (process.env.TRUSTED_ORIGINS ?? "").split(",")) {
    const value = entry.trim();
    if (value) origins.add(value.replace(/\/$/, ""));
  }

  if (process.env.NODE_ENV !== "production") {
    const port = frontend.port || (frontend.protocol === "https:" ? "443" : "80");

    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.internal || address.family !== "IPv4") continue;
        origins.add(`${frontend.protocol}//${address.address}:${port}`);
      }
    }
  }

  return [...origins];
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: buildTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned by an admin or seeded; no public sign-up.
    disableSignUp: process.env.ALLOW_SIGNUP !== "true",
    sendResetPassword: async ({ user, url }) => {
      await getMailer().send({
        to: user.email,
        subject: "Reset your Mushak password",
        text: [
          `Hi ${user.name},`,
          "",
          "Use this link to choose a new password:",
          "",
          url,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: [
          `<p>Hi ${escapeHtml(user.name)},</p>`,
          `<p><a href="${escapeHtml(url)}">Choose a new password</a></p>`,
          "<p>If you did not request this, you can ignore this email.</p>",
        ].join(""),
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await getMailer().send({
        to: user.email,
        subject: "Verify your Mushak email",
        text: [
          `Hi ${user.name},`,
          "",
          "Verify your email address:",
          "",
          url,
        ].join("\n"),
        html: [
          `<p>Hi ${escapeHtml(user.name)},</p>`,
          `<p><a href="${escapeHtml(url)}">Verify your email address</a></p>`,
        ].join(""),
      });
    },
  },
  user: {
    modelName: "users",
    additionalFields: {
      // Set from the database for merchant-scoped accounts.
      merchantId: { type: "string", required: false, input: false },
    },
  },
  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  plugins: [
    admin({
      ac,
      roles: {
        super_admin: superAdminRole,
        dev: devRole,
        merchant: merchantRole,
        staff: staffRole,
      },
      defaultRole: "staff",
      adminRoles: ["super_admin", "dev"],
      impersonationSessionDuration: 60 * 60,
    }),
    phoneNumber({
      // OTP delivery is not configured. Email/password and phone/password both
      // work; only the OTP endpoints would call this.
      sendOTP: async () => {
        throw new Error(
          "SMS OTP is not configured. Sign in with a password instead.",
        );
      },
    }),
  ],
});

export type Auth = typeof auth;

declare module "fastify" {
  interface FastifyRequest {
    authSession: Awaited<ReturnType<typeof auth.api.getSession>>;
  }
}
