import { createAuthClient } from "better-auth/react";
import { adminClient, phoneNumberClient } from "better-auth/client/plugins";

import { withBasePath } from "@/lib/base-path";

/**
 * Lokkhi runs on its own origin, so it mounts its own Better Auth handler and
 * owns its own session cookie. Users, merchants and sessions come from the
 * shared database, so the same account works in Mushak and Lokkhi.
 *
 * The API lives under the app's public base path, so it follows the same
 * prefix as the rest of the app when deployed under `/lokkhi`.
 */
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}${withBasePath("/api/auth")}`,
  plugins: [adminClient(), phoneNumberClient()],
});
