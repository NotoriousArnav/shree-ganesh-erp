import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import PageHeader from "@/components/page-header";
import ProductDialog from "@/components/product-dialog";
import StockDialog from "@/components/stock-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { money, qty } from "@/lib/format";
import { imageSrc } from "@/lib/images";
import { usePermissions } from "@/lib/permissions";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  /**
   * inventory — on-hand stock: quantities, values and stock movements.
   * catalogue — product definitions: names, prices, SKU and GST.
   */
  variant: "inventory" | "catalogue";
};

/**
 * Shared product workspace for the Inventory and Catalogue tabs.
 *
 * One implementation keeps the list, filters and dialogs identical between the
 * two screens; `variant` decides the columns and the row actions.
 */
export default function ProductList({ variant }: Props) {
  const inventory = variant === "inventory";
  const basePath = inventory ? "/api/merchant/inventory" : "/api/merchant/catalogue";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [archiveFor, setArchiveFor] = useState<Product | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadCategories = useCallback(() => {
    api<Category[]>("/api/merchant/categories")
      .then(setCategories)
      .catch(() => {
        // The list still works without categories.
      });
  }, []);

  useEffect(loadCategories, [loadCategories]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (categoryId) params.set("categoryId", categoryId);
    if (inventory && lowStock) params.set("lowStock", "true");
    if (includeInactive) params.set("includeInactive", "true");

    setLoading(true);
    setError(null);

    api<Product[]>(`${basePath}?${params.toString()}`)
      .then(setProducts)
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [basePath, inventory, query, categoryId, lowStock, includeInactive]);

  useEffect(load, [load]);

  /** Both tabs add through the same dialog, so the label never changes. */
  function addProduct() {
    setEditing("new");
  }

  async function confirmArchive() {
    if (!archiveFor) return;

    try {
      await api(`${basePath}/${archiveFor.id}`, { method: "DELETE" });
      setArchiveFor(null);
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function restore(product: Product) {
    try {
      await api(`${basePath}/${product.id}`, {
        method: "PATCH",
        body: { isActive: true },
      });
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const title = inventory ? "Inventory" : "Catalogue";
  const description = inventory
    ? canStock
      ? "On-hand stock, values and reorder levels. Adding a product here also puts it in the catalogue."
      : "On-hand stock and reorder levels for this shop."
    : canEdit
      ? "Product definitions, prices, SKU and GST for this shop."
      : canStock
        ? "You can view the catalogue and move stock. The catalogue is managed by the shop owner."
        : "You can view the catalogue. Ask the shop owner for stock or catalogue access.";

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={
          canEdit ? <Button onClick={addProduct}>Add product</Button> : null
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

        {inventory ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={lowStock}
              onChange={(event) => setLowStock(event.target.checked)}
            />
            Low stock only
          </label>
        ) : null}

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
              {inventory ? (
                <>
                  <th className="px-4 py-2.5 font-medium">Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium">Purchase</th>
                </>
              ) : null}
              <th className="px-4 py-2.5 text-right font-medium">Selling</th>
              <th className="px-4 py-2.5 text-right font-medium">GST</th>
              {inventory ? null : (
                <th className="px-4 py-2.5 font-medium">Unit</th>
              )}
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const low =
                product.reorderLevel > 0 && product.stockQty <= product.reorderLevel;
              const thumbnail = imageSrc(
                inventory
                  ? (product.inventoryImageKey ?? product.imageKey)
                  : product.imageKey,
              );

              return (
                <tr
                  key={product.id}
                  className={cn("border-t", !product.isActive && "bg-muted/30")}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt=""
                          loading="lazy"
                          className="size-10 shrink-0 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-medium text-muted-foreground">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
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
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {product.categoryName ?? "—"}
                  </td>
                  {inventory ? (
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
                  ) : null}
                  {inventory ? (
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {money(product.purchasePrice)}
                    </td>
                  ) : null}
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(product.sellingPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {product.taxRate}%
                  </td>
                  {inventory ? null : (
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {product.unit}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {inventory ? (
                        <>
                          {canStock && product.isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStockFor(product)}
                            >
                              Stock
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/app/inventory/${product.id}`)}
                          >
                            View
                          </Button>
                        </>
                      ) : (
                        <>
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
                                onClick={() => setArchiveFor(product)}
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

                          {!canEdit ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                navigate(
                                  `/app/inventory/${product.inventoryItemId ?? product.id}`,
                                )
                              }
                            >
                              View
                            </Button>
                          ) : null}
                        </>
                      )}
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
                ? "Nothing here yet. Add the first product to get started."
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
          resource={variant}
          categories={categories}
          canCreateCategories={can("categories")}
          canSetOpeningStock={canStock}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
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

      <ConfirmDialog
        open={archiveFor !== null}
        onClose={() => setArchiveFor(null)}
        title="Archive product"
        description={
          archiveFor
            ? `Archive "${archiveFor.name}"? It disappears from the list and stock history is kept.`
            : undefined
        }
        confirmLabel="Archive"
        onConfirm={() => void confirmArchive()}
      />
    </div>
  );
}
