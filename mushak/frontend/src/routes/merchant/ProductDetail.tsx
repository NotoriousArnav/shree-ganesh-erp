import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import PageHeader from "@/components/page-header";
import ProductDialog from "@/components/product-dialog";
import StockDialog from "@/components/stock-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { dateTime, money, movementLabels, qty } from "@/lib/format";
import { imageSrc } from "@/lib/images";
import { usePermissions } from "@/lib/permissions";
import type { Category, Movement, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type MovementsResponse = {
  product: { id: string; name: string; unit: string };
  movements: Movement[];
};

export default function ProductDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can("catalogue");
  const canStock = can("stock");

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [archiveFor, setArchiveFor] = useState<Product | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    api<Product>(`/api/merchant/inventory/${id}`)
      .then(setProduct)
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));

    if (!canStock) {
      setMovements([]);
      return;
    }

    api<MovementsResponse>(`/api/merchant/inventory/${id}/movements`)
      .then((result) => setMovements(result.movements))
      .catch(() => {
        // Stock history is a stock-permission view; merchants always have it.
      });
  }, [id, canStock]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<Category[]>("/api/merchant/categories")
      .then(setCategories)
      .catch(() => {
        // The edit dialog works without categories.
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Product" description="Loading…" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-5">
        <PageHeader title="Product" />
        <p className="rounded-md border bg-background px-4 py-8 text-center text-sm text-destructive">
          {error ?? "Product not found."}
        </p>
      </div>
    );
  }

  const low = product.reorderLevel > 0 && product.stockQty <= product.reorderLevel;
  const image = imageSrc(product.inventoryImageKey ?? product.imageKey);

  async function archiveProduct() {
    if (!archiveFor) return;

    try {
      await api(`/api/merchant/inventory/${archiveFor.id}`, { method: "DELETE" });
      setArchiveFor(null);
      navigate("/app/inventory");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="size-20 shrink-0 rounded-lg border object-cover sm:size-24"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border bg-muted text-xl font-semibold text-muted-foreground sm:size-24">
            {product.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <PageHeader
            title={product.name}
            description={
              product.sku
                ? `SKU ${product.sku} · ${product.barcode ?? "No barcode"} · ${
                    product.categoryName ?? "Uncategorised"
                  }`
                : `No SKU · ${product.barcode ?? "No barcode"} · ${
                    product.categoryName ?? "Uncategorised"
                  }`
            }
            actions={
              <>
                {canStock && product.isActive ? (
                  <Button onClick={() => setStockFor(product)}>Stock</Button>
                ) : null}

                {canEdit && product.isActive ? (
                  <>
                    <Button variant="outline" onClick={() => setEditing(product)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="text-muted-foreground"
                      onClick={() => setArchiveFor(product)}
                    >
                      Archive
                    </Button>
                  </>
                ) : null}
              </>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            On hand
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {qty(product.stockQty)} {product.unit}
          </p>
          {low ? <Badge variant="warning">Low stock</Badge> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Reorder at {qty(product.reorderLevel)} {product.unit}
          </p>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pricing
          </p>
          <p className="mt-1 text-sm">
            Purchase{" "}
            <span className="tabular-nums">{money(product.purchasePrice)}</span>
          </p>
          <p className="mt-0.5 text-sm">
            Selling{" "}
            <span className="tabular-nums">{money(product.sellingPrice)}</span>
          </p>
          <p className="mt-0.5 text-sm">
            GST <span className="tabular-nums">{product.taxRate}%</span>
            {product.hsnCode ? ` · HSN ${product.hsnCode}` : ""}
          </p>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Details
          </p>
          <p className="mt-1 text-sm">Unit: {product.unit}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Added {dateTime(product.createdAt)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 text-right font-medium">Change</th>
              <th className="px-4 py-2.5 text-right font-medium">Unit cost</th>
              <th className="px-4 py-2.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {dateTime(movement.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={movement.quantity > 0 ? "success" : "secondary"}>
                    {movementLabels[movement.type] ?? movement.type}
                  </Badge>
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-medium tabular-nums",
                    movement.quantity > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {movement.quantity > 0 ? "+" : ""}
                  {qty(movement.quantity)} {movement.unit}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {movement.unitCost === null ? "—" : money(movement.unitCost)}
                </td>
                <td className="max-w-56 truncate px-4 py-2.5 text-muted-foreground">
                  {movement.note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && movements.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            No stock movements for this product yet.
          </p>
        ) : null}
      </div>

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

      {editing ? (
        <ProductDialog
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          resource="inventory"
          categories={categories}
          canCreateCategories={can("categories")}
          canSetOpeningStock={canStock}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
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
            ? `Archive "${archiveFor.name}"? It disappears from the product list and stock history is kept.`
            : undefined
        }
        confirmLabel="Archive"
        onConfirm={() => void archiveProduct()}
      />
    </div>
  );
}
