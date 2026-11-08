import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  gstin: string | null;
  phone: string | null;
  currency: string;
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

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
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
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newMerchant, setNewMerchant] = useState({
    name: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerPhone: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editMerchant, setEditMerchant] = useState<MerchantRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    gstin: "",
    phone: "",
    currency: "INR",
  });

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

  async function refreshLists() {
    setLoading(true);
    setError(null);

    try {
      const [merchantRows, userRows] = await Promise.all([
        fetchJson<MerchantRow[]>("/api/admin/merchants"),
        fetchJson<UserRow[]>("/api/admin/users"),
      ]);
      setMerchants(merchantRows);
      setUsers(userRows);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function createMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);

    if (!newMerchant.name.trim()) {
      setAddError("Give the shop a name.");
      return;
    }

    if (!newMerchant.ownerEmail.trim() || newMerchant.ownerPassword.length < 8) {
      setAddError("The shop owner needs an email and a password of at least 8 characters.");
      return;
    }

    setAddBusy(true);

    try {
      const merchant = await fetchJson<{ id: string }>("/api/admin/merchants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newMerchant.name.trim(),
          phone: newMerchant.ownerPhone.trim() || null,
        }),
      });

      await fetchJson(`/api/admin/merchants/${merchant.id}/users`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newMerchant.ownerName.trim() || "Shop Owner",
          email: newMerchant.ownerEmail.trim(),
          password: newMerchant.ownerPassword,
          phoneNumber: newMerchant.ownerPhone.trim() || null,
          permissions: ["stock", "catalogue", "categories"],
        }),
      });

      setAddOpen(false);
      setNewMerchant({ name: "", ownerName: "", ownerEmail: "", ownerPassword: "", ownerPhone: "" });
      await refreshLists();
    } catch (cause: unknown) {
      setAddError(cause instanceof Error ? cause.message : "Could not create merchant");
    } finally {
      setAddBusy(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);

    if (!editMerchant) return;
    if (!editForm.name.trim()) {
      setEditError("Give the shop a name.");
      return;
    }

    setEditBusy(true);

    try {
      await fetchJson(`/api/admin/merchants/${editMerchant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          slug: editForm.slug.trim() || undefined,
          gstin: editForm.gstin.trim() || null,
          phone: editForm.phone.trim() || null,
          currency: editForm.currency.trim() || "INR",
        }),
      });

      setEditOpen(false);
      setEditMerchant(null);
      await refreshLists();
    } catch (cause: unknown) {
      setEditError(cause instanceof Error ? cause.message : "Could not update merchant");
    } finally {
      setEditBusy(false);
    }
  }

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
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-muted-foreground">
                  {merchants.length} total
                </span>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Add merchant
                </Button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Slug</th>
                    <th className="px-4 py-2.5 font-medium">GSTIN</th>
                    <th className="px-4 py-2.5 font-medium">Phone</th>
                    <th className="px-4 py-2.5 font-medium">Currency</th>
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
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {merchant.currency}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditMerchant(merchant);
                            setEditForm({
                              name: merchant.name,
                              slug: merchant.slug,
                              gstin: merchant.gstin ?? "",
                              phone: merchant.phone ?? "",
                              currency: merchant.currency,
                            });
                            setEditOpen(true);
                            setEditError(null);
                          }}
                      >
                        Edit
                      </Button>
                    </td>
                    </tr>
                  ))}
                  {merchants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
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

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add merchant">
        <form className="space-y-4" onSubmit={createMerchant}>
          <div className="space-y-1.5">
            <Label htmlFor="merchant-name">Shop name</Label>
            <Input
              id="merchant-name"
              value={newMerchant.name}
              onChange={(event) => setNewMerchant({ ...newMerchant, name: event.target.value })}
              placeholder="Anime Point Siliguri"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="merchant-owner-name">Owner name</Label>
              <Input
                id="merchant-owner-name"
                value={newMerchant.ownerName}
                onChange={(event) => setNewMerchant({ ...newMerchant, ownerName: event.target.value })}
                placeholder="Deepak Kothiyal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="merchant-owner-phone">Owner phone (optional)</Label>
              <Input
                id="merchant-owner-phone"
                value={newMerchant.ownerPhone}
                onChange={(event) => setNewMerchant({ ...newMerchant, ownerPhone: event.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="merchant-owner-email">Owner email</Label>
              <Input
                id="merchant-owner-email"
                type="email"
                value={newMerchant.ownerEmail}
                onChange={(event) => setNewMerchant({ ...newMerchant, ownerEmail: event.target.value })}
                placeholder="deepak@anime-point.in"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="merchant-owner-password">Owner password</Label>
              <Input
                id="merchant-owner-password"
                type="password"
                value={newMerchant.ownerPassword}
                onChange={(event) => setNewMerchant({ ...newMerchant, ownerPassword: event.target.value })}
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          {addError ? (
            <p className="text-sm text-destructive" role="alert">{addError}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addBusy}>
              {addBusy ? "Creating…" : "Create merchant"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit merchant">
        <form className="space-y-4" onSubmit={saveEdit}>
          <div className="space-y-1.5">
            <Label htmlFor="edit-merchant-name">Shop name</Label>
            <Input
              id="edit-merchant-name"
              value={editForm.name}
              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-merchant-slug">Slug</Label>
              <Input
                id="edit-merchant-slug"
                value={editForm.slug}
                onChange={(event) => setEditForm({ ...editForm, slug: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-merchant-gstin">GSTIN</Label>
              <Input
                id="edit-merchant-gstin"
                value={editForm.gstin}
                onChange={(event) => setEditForm({ ...editForm, gstin: event.target.value })}
                placeholder="27AABCU9603R1ZMXX"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-merchant-phone">Phone</Label>
              <Input
                id="edit-merchant-phone"
                value={editForm.phone}
                onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-merchant-currency">Currency</Label>
              <Input
                id="edit-merchant-currency"
                value={editForm.currency}
                onChange={(event) => setEditForm({ ...editForm, currency: event.target.value })}
              />
            </div>
          </div>

          {editError ? (
            <p className="text-sm text-destructive" role="alert">{editError}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editBusy}>
              {editBusy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>

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
