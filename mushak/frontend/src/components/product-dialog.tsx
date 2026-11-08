import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

const units = [
  "pcs",
  "kg",
  "g",
  "litre",
  "ml",
  "box",
  "packet",
  "dozen",
  "bundle",
  "metre",
  "sqft",
];

type Props = {
  product: Product | null;
  /** Which table the form writes to: the stock row or the definition. */
  resource: "inventory" | "catalogue";
  categories: Category[];
  /** Staff without the categories permission may only pick an existing one. */
  canCreateCategories: boolean;
  /** Opening stock is a stock movement, so it needs the stock permission. */
  canSetOpeningStock: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProductDialog({
  product,
  resource,
  categories,
  canCreateCategories,
  canSetOpeningStock,
  onClose,
  onSaved,
}: Props) {
  const inventory = resource === "inventory";
  const isNew = product === null;

  const [name, setName] = useState(product?.name ?? "");
  const [categoryName, setCategoryName] = useState(product?.categoryName ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "pcs");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [hsnCode, setHsnCode] = useState(product?.hsnCode ?? "");
  const [taxRate, setTaxRate] = useState(String(product?.taxRate ?? 0));
  const [purchasePrice, setPurchasePrice] = useState(
    String(product?.purchasePrice ?? 0),
  );
  const [sellingPrice, setSellingPrice] = useState(
    String(product?.sellingPrice ?? 0),
  );
  const [reorderLevel, setReorderLevel] = useState(
    String(product?.reorderLevel ?? 0),
  );
  const [openingStock, setOpeningStock] = useState("0");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Give the product a name.");
      return;
    }

    const payload = {
      name: name.trim(),
      // Always send the name: blank clears it, a new name is created on save.
      categoryName: categoryName.trim() || null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      unit,
      hsnCode: hsnCode.trim() || null,
      taxRate: Number(taxRate) || 0,
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      // Reorder levels belong to the stock row, so only send them where it
      // exists or the API accepts them.
      ...(inventory || !isNew ? { reorderLevel: Number(reorderLevel) || 0 } : {}),
    };

    setBusy(true);

    try {
      if (isNew) {
        await api<Product>(`/api/merchant/${resource}`, {
          method: "POST",
          body: inventory
            ? {
                ...payload,
                stockQty: canSetOpeningStock ? Number(openingStock) || 0 : 0,
              }
            : payload,
        });
      } else {
        await api<Product>(`/api/merchant/${resource}/${product.id}`, {
          method: "PATCH",
          body: payload,
        });
      }

      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? "Add product" : "Edit product"}
      description={
        isNew
          ? inventory
            ? "Selling price and stock are enough to start; the rest is optional."
            : "Selling price is enough to start; stock is managed on the Inventory tab."
          : inventory
            ? "Stock is changed through Stock so the history stays accurate."
            : "Changes apply wherever this product is stocked."
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="product-name">Name</Label>
          <Input
            id="product-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Basmati rice 5 kg"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-category">Category</Label>
            {canCreateCategories ? (
              <>
                <Input
                  id="product-category"
                  list="product-category-options"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Dairy, Snacks…"
                  autoComplete="off"
                />
                <datalist id="product-category-options">
                  {categories.map((category) => (
                    <option key={category.id} value={category.name} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Existing or new — created on save.
                </p>
              </>
            ) : (
              <>
                <Select
                  id="product-category"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Ask the shop owner to add a new category.
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-unit">Unit</Label>
            <Select
              id="product-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {units.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-sku">SKU</Label>
            <Input
              id="product-sku"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder={isNew ? "Auto from name" : "RICE-5"}
            />
            {isNew ? (
              <p className="text-xs text-muted-foreground">
                Blank? Generated from the name.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-barcode">Barcode (optional)</Label>
            <Input
              id="product-barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="Not needed for every item"
            />
          </div>        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-hsn">HSN code</Label>
            <Input
              id="product-hsn"
              value={hsnCode}
              onChange={(event) => setHsnCode(event.target.value)}
              placeholder="1006"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-tax">GST %</Label>
            <Input
              id="product-tax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-purchase">Purchase price</Label>
            <Input
              id="product-purchase"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-selling">Selling price</Label>
            <Input
              id="product-selling"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {inventory || !isNew ? (
            <div className="space-y-1.5">
              <Label htmlFor="product-reorder">Low-stock level</Label>
              <Input
                id="product-reorder"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={reorderLevel}
                onChange={(event) => setReorderLevel(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Warn when stock falls to this.
              </p>
            </div>
          ) : null}

          {isNew && inventory && canSetOpeningStock ? (
            <div className="space-y-1.5">
              <Label htmlFor="product-opening">Opening stock</Label>
              <Input
                id="product-opening"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={openingStock}
                onChange={(event) => setOpeningStock(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Recorded as a stock movement.
              </p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add product" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
