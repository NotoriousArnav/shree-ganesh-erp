import { createAuthClient } from "better-auth/react";
import { adminClient, phoneNumberClient } from "better-auth/client/plugins";

import { withBasePath } from "@/lib/base-path";

/**
 * The API lives under the app's public base path, so it follows the same
 * prefix as the rest of the app when deployed under `/mushak`.
 */
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}${withBasePath("/api/auth")}`,
  plugins: [adminClient(), phoneNumberClient()],
});
