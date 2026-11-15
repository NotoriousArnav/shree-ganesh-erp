import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";

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
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <img
        src={withBasePath("/brand/shree-ganesh-erp.png")}
        alt="Shree Ganesh ERP"
        className="h-36 w-auto max-w-full"
      />

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Shree Ganesh ERP presents
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Mushak</h1>
        <p className="mt-2 text-muted-foreground">
          Inventory management for small merchants. Sales and purchase invoices
          are in Lokkhi.
        </p>
      </div>

      <img
        src={withBasePath("/brand/mushak.png")}
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
                <Link to="/app">Open dashboard</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <a href={import.meta.env.VITE_LOKKHI_APP_URL || "/lokkhi/"}>
                Open Lokkhi
              </a>
            </Button>
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
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={import.meta.env.VITE_LOKKHI_APP_URL || "/lokkhi/"}>
              Open Lokkhi
            </a>
          </Button>
        </div>
      )}
    </main>
  );
}
