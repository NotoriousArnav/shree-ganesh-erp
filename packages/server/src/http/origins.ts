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

    // Loopback is skipped by the networkInterfaces() loop below. Trust both
    // spellings so http://localhost:5173 and http://127.0.0.1:5173 behave the
    // same; otherwise signing in from 127.0.0.1 fails with "Invalid origin".
    origins.add(`${frontend.protocol}//127.0.0.1:${port}`);
    origins.add(`${frontend.protocol}//[::1]:${port}`);

    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.internal || address.family !== "IPv4") continue;
        origins.add(`${frontend.protocol}//${address.address}:${port}`);
      }
    }
  }

  return [...origins];
}

/**
 * Origins the auth layer accepts.
 *
 * Development trusts every origin, so a phone on the LAN, an mDNS name such as
 * `http://laptop.local:5173`, a tunnel, or a container hostname never trips
 * "Invalid origin". Production keeps the explicit list built by
 * `buildTrustedOrigins()` unless `TRUSTED_ORIGINS` contains `*`.
 *
 * The storage CORS policy keeps using `buildTrustedOrigins()`: S3 needs concrete
 * origins, and presigned uploads do not send credentials.
 */
export function buildAuthTrustedOrigins(): string[] {
  const origins = buildTrustedOrigins();
  const production = process.env.NODE_ENV === "production";
  const trustAll = !production || origins.includes("*");

  if (!trustAll) return origins;

  if (production) {
    console.warn(
      "[auth] TRUSTED_ORIGINS=* accepts requests from every origin. " +
        "Better Auth's origin and redirect checks are effectively off; " +
        "session cookies still use SameSite=Lax.",
    );
  }

  return ["*", ...origins.filter((origin) => origin !== "*")];
}
