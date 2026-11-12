import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-lg px-3 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-neutral-900 text-white"
      : "text-neutral-600 hover:bg-neutral-100",
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
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  if (state === "anonymous") return null;

  return (
    <div className="min-h-screen">
      <header className="print-hide border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">Lokkhi</span>
              <span className="text-xs text-neutral-400">Invoices</span>
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navClass}>
                Invoices
              </NavLink>
              <Link
                to="/?kind=purchase"
                className="rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Purchases
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {merchantName}
            </span>
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
