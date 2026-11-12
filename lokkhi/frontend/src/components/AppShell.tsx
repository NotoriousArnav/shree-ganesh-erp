import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";
import ThemeToggle from "@/components/theme-toggle";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-lg px-3 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground",
  ].join(" ");
}

/**
 * Every page is behind a session check. On a separate server Lokkhi owns its
 * own cookie, so a missing session simply means "sign in here".
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ready" | "anonymous">(
    "loading",
  );
  const [merchantName, setMerchantName] = useState("");

  useEffect(() => {
    let cancelled = false;

    authClient.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data?.session) {
        setState("anonymous");
        navigate("/login", { replace: true });
        return;
      }
      setMerchantName(data.user.name ?? "Shop");
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (state === "anonymous") return null;

  return (
    <div className="min-h-screen">
      <header className="print-hide border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">
                Lokkhi
              </span>
              <span className="text-xs text-muted-foreground">Invoices</span>
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navClass}>
                Invoices
              </NavLink>
              <Link
                to="/?kind=purchase"
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Purchases
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {merchantName}
            </span>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await authClient.signOut();
                navigate("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
