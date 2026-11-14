import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { authClient } from "@/lib/auth-client";
import { homePathForRole } from "@/lib/roles";

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

  // Send the user to the area their role can actually use instead of showing a
  // dead end. A platform role lands on /admin, a shop role on /app.
  if (!role || !roles.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <>{children}</>;
}
