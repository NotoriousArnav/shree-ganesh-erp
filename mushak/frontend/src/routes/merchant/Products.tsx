import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import PageHeader from "@/components/page-header";
import ProductDialog from "@/components/product-dialog";
import StockDialog from "@/components/stock-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { money, qty } from "@/lib/format";
import { usePermissions } from "@/lib/permissions";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Products() {
  const [searchParams] = useSearchParams();
  const { can } = usePermissions();
  const canEdit = can("catalogue");
  const canStock = can("stock");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStock, setLowStock] = useState(searchParams.get("lowStock") === "1");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadCategories = useCallback(() => {
    api<Category[]>("/api/merchant/categories")
      .then(setCategories)
      .catch(() => {
        // The product list still works without categories.
      });
  }, []);

  useEffect(loadCategories, [loadCategories]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (categoryId) params.set("categoryId", categoryId);
    if (lowStock) params.set("lowStock", "true");
    if (includeInactive) params.set("includeInactive", "true");

    setLoading(true);
    setError(null);

    api<Product[]>(`/api/merchant/products?${params.toString()}`)
      .then(setProducts)
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [query, categoryId, lowStock, includeInactive]);

  useEffect(load, [load]);

  async function archive(product: Product) {
    if (
      !window.confirm(
        `Archive "${product.name}"? It disappears from the product list and stock history is kept.`,
      )
    ) {
      return;
    }

    try {
      await api(`/api/merchant/products/${product.id}`, { method: "DELETE" });
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function restore(product: Product) {
    try {
      await api(`/api/merchant/products/${product.id}`, {
        method: "PATCH",
        body: { isActive: true },
      });
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        description={
          canEdit
            ? "Catalogue, prices and stock for this shop."
            : canStock
              ? "You can view products and move stock. The catalogue is managed by the shop owner."
              : "You can view the catalogue. Ask the shop owner for stock or catalogue access."
        }
        actions={
          canEdit ? (
            <Button onClick={() => setEditing("new")}>Add product</Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, SKU or barcode"
          className="h-9 w-full sm:w-64"
        />

        <Select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="w-full sm:w-48"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={lowStock}
            onChange={(event) => setLowStock(event.target.checked)}
          />
          Low stock only
        </label>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Show archived
        </label>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Stock</th>
              <th className="px-4 py-2.5 text-right font-medium">Purchase</th>
              <th className="px-4 py-2.5 text-right font-medium">Selling</th>
              <th className="px-4 py-2.5 text-right font-medium">GST</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const low =
                product.reorderLevel > 0 &&
                product.stockQty <= product.reorderLevel;

              return (
                <tr
                  key={product.id}
                  className={cn("border-t", !product.isActive && "bg-muted/30")}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.name}</span>
                      {!product.isActive ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {product.sku ?? "No SKU"}
                      {product.barcode ? ` · ${product.barcode}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {product.categoryName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "tabular-nums",
                          low && "font-medium text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {qty(product.stockQty)} {product.unit}
                      </span>
                      {low ? <Badge variant="warning">Low</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {money(product.purchasePrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(product.sellingPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {product.taxRate}%
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {canStock && product.isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStockFor(product)}
                        >
                          Stock
                        </Button>
                      ) : null}

                      {canEdit && product.isActive ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(product)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => void archive(product)}
                          >
                            Archive
                          </Button>
                        </>
                      ) : null}

                      {canEdit && !product.isActive ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void restore(product)}
                        >
                          Restore
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && products.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            {query || categoryId || lowStock
              ? "No products match these filters."
              : canEdit
                ? "No products yet. Add the first one to start tracking stock."
                : "No products yet."}
          </p>
        ) : null}

        {loading ? (
          <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : null}
      </div>

      {editing ? (
        <ProductDialog
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          categories={categories}
          canCreateCategories={can("categories")}
          canSetOpeningStock={canStock}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            // A new category may have been typed in the dialog.
            loadCategories();
          }}
        />
      ) : null}

      {stockFor ? (
        <StockDialog
          key={stockFor.id}
          product={stockFor}
          onClose={() => setStockFor(null)}
          onSaved={() => {
            setStockFor(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
