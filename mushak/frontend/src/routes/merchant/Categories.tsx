import { useCallback, useEffect, useState, type FormEvent } from "react";

import PageHeader from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { Category } from "@/lib/types";

export default function Categories() {
  const { data: session } = authClient.useSession();
  const canEdit = session?.user.role === "merchant";

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api<Category[]>("/api/merchant/categories")
      .then(setCategories)
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return;

    setBusy(true);

    try {
      await api<Category>("/api/merchant/categories", {
        method: "POST",
        body: { name: name.trim() },
      });
      setName("");
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string) {
    setError(null);

    if (!editingName.trim()) return;

    setBusy(true);

    try {
      await api(`/api/merchant/categories/${id}`, {
        method: "PATCH",
        body: { name: editingName.trim() },
      });
      setEditingId(null);
      setEditingName("");
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: Category) {
    const note =
      category.productCount > 0
        ? ` ${category.productCount} product(s) will become uncategorised.`
        : "";

    if (!window.confirm(`Delete "${category.name}"?${note}`)) return;

    setError(null);

    try {
      await api(`/api/merchant/categories/${category.id}`, {
        method: "DELETE",
      });
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories"
        description={
          canEdit
            ? "Group products so the list stays easy to scan."
            : "Categories are managed by the merchant."
        }
      />

      {canEdit ? (
        <Card>
          <CardContent className="p-4">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={create}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="New category, e.g. Dairy"
                className="sm:max-w-xs"
                required
              />
              <Button type="submit" disabled={busy}>
                {busy ? "Adding…" : "Add category"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="divide-y rounded-lg border bg-background">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            {editingId === category.id ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  className="h-8 sm:max-w-xs"
                  aria-label="Category name"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void rename(category.id);
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void rename(category.id)}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{category.name}</span>
                <Badge variant="outline">
                  {category.productCount} product
                  {category.productCount === 1 ? "" : "s"}
                </Badge>
              </div>
            )}

            {canEdit && editingId !== category.id ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(category.id);
                    setEditingName(category.name);
                  }}
                >
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => void remove(category)}
                >
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        ))}

        {!loading && categories.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No categories yet.
          </p>
        ) : null}

        {loading && categories.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : null}
      </div>
    </div>
  );
}
