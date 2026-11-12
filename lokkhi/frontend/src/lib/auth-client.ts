import { createAuthClient } from "better-auth/react";
import { adminClient, phoneNumberClient } from "better-auth/client/plugins";

/**
 * Lokkhi runs on its own origin, so it mounts its own Better Auth handler and
 * owns its own session cookie. Users, merchants and sessions come from the
 * shared database, so the same account works in Mushak and Lokkhi.
 */
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  plugins: [adminClient(), phoneNumberClient()],
});
