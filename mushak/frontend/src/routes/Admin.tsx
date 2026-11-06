import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  gstin: string | null;
  phone: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  merchantId: string | null;
  banned: boolean | null;
  createdAt: string;
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  dev: "Dev",
  merchant: "Merchant",
  staff: "Staff",
};

const roleStyles: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  dev: "bg-secondary text-secondary-foreground",
  merchant: "border border-border bg-background",
  staff: "border border-border bg-muted text-muted-foreground",
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleStyles[role] ?? "border border-border"}`}
    >
      {roleLabels[role] ?? role}
    </span>
  );
}

export default function Admin() {
  const { data } = authClient.useSession();
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchJson<MerchantRow[]>("/api/admin/merchants"),
      fetchJson<UserRow[]>("/api/admin/users"),
    ])
      .then(([merchantRows, userRows]) => {
        if (cancelled) return;
        setMerchants(merchantRows);
        setUsers(userRows);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const merchantName = (id: string | null) =>
    id ? (merchants.find((merchant) => merchant.id === id)?.name ?? "—") : "—";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Shree Ganesh ERP
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {data?.user.name} ({roleLabels[data?.user.role ?? ""] ?? data?.user.role})
          </p>
        </div>

        <div className="flex gap-2">
          <ThemeToggle />
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
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
      </header>

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {error ? (
        <p className="mt-10 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="mt-10 space-y-10">
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Merchants</h2>
              <span className="text-xs text-muted-foreground">
                {merchants.length} total
              </span>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Slug</th>
                    <th className="px-4 py-2.5 font-medium">GSTIN</th>
                    <th className="px-4 py-2.5 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((merchant) => (
                    <tr key={merchant.id} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{merchant.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {merchant.slug}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {merchant.gstin ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {merchant.phone ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {merchants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No merchants yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Users</h2>
              <span className="text-xs text-muted-foreground">
                {users.length} total
              </span>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Phone</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Merchant</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{user.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {user.phoneNumber ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {merchantName(user.merchantId)}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No users yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Roles and merchant links are managed directly in the database
            (Drizzle Studio).
          </p>
        </div>
      ) : null}
    </main>
  );
}
