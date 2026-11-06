import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  dev: "Dev",
  merchant: "Merchant",
  staff: "Staff",
};

export default function Home() {
  const { data, isPending } = authClient.useSession();
  const role = data?.user.role;
  const isPlatform = role === "super_admin" || role === "dev";
  const isShop = role === "merchant" || role === "staff";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <img
        src="/brand/shree-ganesh-erp.png"
        alt="Shree Ganesh ERP"
        className="h-36 w-auto max-w-full"
      />

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Shree Ganesh ERP presents
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Mushak</h1>
        <p className="mt-2 text-muted-foreground">
          Inventory management for small merchants.
        </p>
      </div>

      <img
        src="/brand/mushak.png"
        alt="Mushak mascot"
        className="h-40 w-auto max-w-full"
      />

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {data.user.name}
            </span>{" "}
            · {roleLabels[role ?? ""] ?? role}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {isPlatform ? (
              <Button asChild>
                <Link to="/admin">Open admin</Link>
              </Button>
            ) : null}
            {isShop ? (
              <Button asChild>
                <Link to="/app">Open shop</Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                void authClient.signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      )}
    </main>
  );
}
