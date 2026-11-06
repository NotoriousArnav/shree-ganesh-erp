import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { authClient } from "@/lib/auth-client";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  dev: "Dev",
  merchant: "Merchant",
  staff: "Staff",
};

type Props = {
  roles: string[];
  children: ReactNode;
};

export default function RequireRole({ roles, children }: Props) {
  const { data, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  const role = data.user.role;

  if (!role || !roles.includes(role)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          403
        </p>
        <h1 className="text-2xl font-semibold">You do not have access</h1>
        <p className="text-sm text-muted-foreground">
          Your role is {role ? (roleLabels[role] ?? role) : "unknown"}. This
          page is limited to a different role.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
