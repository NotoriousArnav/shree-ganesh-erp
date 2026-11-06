import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { qty } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const movementTypes = [
  { value: "purchase", label: "Purchase (stock in)" },
  { value: "sale", label: "Sale (stock out)" },
  { value: "return_in", label: "Customer return (stock in)" },
  { value: "return_out", label: "Return to supplier (stock out)" },
  { value: "damage", label: "Damage / loss (stock out)" },
  { value: "adjustment", label: "Adjustment" },
  { value: "transfer_in", label: "Transfer in" },
  { value: "transfer_out", label: "Transfer out" },
];

const inbound = new Set(["purchase", "return_in", "transfer_in"]);
const outbound = new Set(["sale", "return_out", "damage", "transfer_out"]);

type Props = {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
};

export default function StockDialog({ product, onClose, onSaved }: Props) {
  const [type, setType] = useState("purchase");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount) || 0;
  const signed = inbound.has(type)
    ? value
    : outbound.has(type)
      ? -value
      : direction === "out"
        ? -value
        : value;
  const next = product.stockQty + signed;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (value <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    setBusy(true);

    try {
      await api(`/api/merchant/products/${product.id}/stock`, {
        method: "POST",
        body: {
          type,
          quantity: value,
          ...(type === "adjustment" ? { direction } : {}),
          ...(type === "purchase" && unitCost !== ""
            ? { unitCost: Number(unitCost) || 0 }
            : {}),
          note: note.trim() || null,
        },
      });

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
      title="Move stock"
      description={`${product.name} · ${qty(product.stockQty)} ${product.unit} on hand`}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="stock-type">Reason</Label>
          <Select
            id="stock-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {movementTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>

        {type === "adjustment" ? (
          <div className="space-y-1.5">
            <Label htmlFor="stock-direction">Direction</Label>
            <Select
              id="stock-direction"
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value === "out" ? "out" : "in")
              }
            >
              <option value="in">Increase stock</option>
              <option value="out">Decrease stock</option>
            </Select>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="stock-quantity">
              Quantity ({product.unit})
            </Label>
            <Input
              id="stock-quantity"
              autoFocus
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              required
            />
          </div>

          {type === "purchase" ? (
            <div className="space-y-1.5">
              <Label htmlFor="stock-cost">Unit cost (optional)</Label>
              <Input
                id="stock-cost"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                placeholder="0.00"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stock-note">Note (optional)</Label>
          <Textarea
            id="stock-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Counter sale, damaged pack, supplier bill…"
            rows={2}
          />
        </div>

        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            next < 0
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "bg-muted/50 text-muted-foreground",
          )}
        >
          {next < 0
            ? `Only ${qty(product.stockQty)} ${product.unit} available.`
            : `Stock after this: ${qty(product.stockQty)} → ${qty(next)} ${product.unit}`}
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || next < 0}>
            {busy ? "Saving…" : value > 0 ? `Move ${qty(value)}` : "Move stock"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
