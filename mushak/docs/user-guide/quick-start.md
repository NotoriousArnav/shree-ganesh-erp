# Quick start

One page for a shop that is already set up. For the full explanations, follow
the [user guide](README.md).

## 1. Sign in

Open the shop address, enter your email or phone and your password.

- Shop accounts land on **Dashboard**.
- Platform administrators land on **Admin**.

## 2. Set the shop details

**Settings** → shop name, phone, currency, GSTIN and address → **Save changes**.
Only the shop owner can do this.

## 3. Create a few categories

**Categories** → type a name → **Add category**. Examples: `Dairy`, `Snacks`,
`Grains`, `Household`.

## 4. Add products

**Catalogue** → **Add product**:

| Field | What to enter |
| --- | --- |
| Name | `Basmati rice 5 kg` |
| Category | Pick or type one |
| Unit | `kg` |
| Selling price | `120` |
| GST | `5` |
| SKU | Leave blank to generate |
| Barcode | Scan if there is one |

Saving creates the product with **0 stock**.

## 5. Bring in stock

**Inventory** → find the product → **Stock**:

1. Reason: **Purchase (stock in)**.
2. Quantity: what arrived.
3. Unit cost: what you paid per unit.
4. Note: the supplier bill number.
5. Save.

The quantity updates and the movement is recorded.

## 6. Record a sale

**Inventory** → **Stock** → **Sale (stock out)** → quantity → note `Counter
sale` → save.

Mushak records the stock change. It does not create an invoice or take payment.

## 7. Watch the dashboard

**Dashboard** shows active products, low stock, stock value and today's
movements. Set a **low-stock level** on each product to make the warning useful;
`0` disables it.

## 8. Add a counter helper

**Staff** → **Add staff** → name, email, temporary password → tick **Stock** →
save.

They can record stock and view products. Give **Catalogue** or **Categories**
only if they should change definitions or groups.

## Daily routine

- Morning: open **Dashboard**, check **Needs reordering**.
- Deliveries: **Inventory → Stock → Purchase**.
- Sales: **Inventory → Stock → Sale**.
- End of day: **Stock** to review the day's movements.
- Weekly: **Catalogue** to fix prices and archive dead products.

## Things to remember

- Editing a product **never** changes its stock.
- Every stock change is a movement; corrections are new movements, not edits.
- Archive hides a product but keeps its history.
- Staff cannot open Settings or Staff.
- Staff need the Catalogue permission to add or edit products.
- Stock cannot go below zero, and archived products cannot move stock.

## If something is wrong

See [Troubleshooting](11-troubleshooting.md), or check:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/health/db
curl http://localhost:8080/health/storage
```
