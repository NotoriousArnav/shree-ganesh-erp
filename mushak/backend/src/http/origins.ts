import { networkInterfaces } from "node:os";

/**
 * Origins allowed to call the auth API and upload straight to object storage.
 *
 * `FRONTEND_URL` and `BETTER_AUTH_URL` cover the usual case, `TRUSTED_ORIGINS`
 * (comma-separated) covers extra deployments, and in development every LAN
 * address of this machine is added so a phone on the same Wi-Fi can sign in
 * without editing .env whenever the router hands out a new IP.
 *
 * The storage bucket gets the same list as its CORS policy, because browser
 * uploads PUT directly to the object store.
 */
export function buildTrustedOrigins(): string[] {
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
