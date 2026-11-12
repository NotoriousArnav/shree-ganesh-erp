# How Lokkhi organises invoices

## Draft and issued

An invoice starts as a **draft**. A draft:

- has no invoice number yet
- can be edited and deleted
- is private to your shop

When you **issue** a draft, Lokkhi:

1. assigns the next number for that kind and financial year
2. freezes the lines
3. records the issue time
4. attempts the Mushak stock update

After that the invoice can be printed or voided, but not edited. A **void**
invoice keeps its number and its history; it is marked as void rather than
deleted.

## Numbering

Numbers are separate per kind and per financial year:

```text
SALE/2026-27/0001
SALE/2026-27/0002
PUR/2026-27/0001
```

The financial year runs April to March. Counters are per shop, so another shop
cannot consume your numbers.

## Snapshot lines

Every line stores its own copy of the item:

| Stored on the line | Comes from |
| --- | --- |
| Item name | You, or the Mushak suggestion |
| SKU and HSN | You, or the Mushak suggestion |
| Unit | You, or the Mushak suggestion |
| Quantity and price | You |
| Discount and tax rate | You, or the Mushak suggestion |

The line may also point at a Mushak product. That link is optional and it is
never required for the invoice to be valid.

## Tax

Prices are **tax exclusive**. Tax is calculated per line, after discount:

```text
line subtotal = quantity × unit price
line taxable  = subtotal − discount
line tax      = taxable × tax rate ÷ 100
line total    = taxable + tax
```

Lokkhi v1 stores one combined tax rate per line. It does not split CGST, SGST
and IGST. The rate is printed on the invoice so the split can still be read the
usual way; if you need a full split, that is a later feature.

## Parties

Customers and suppliers are **snapshots on the invoice** in v1. A name is
required. Phone and GSTIN are optional; when a phone is present it is shown next
to the name on the invoice and in the invoice list, so the person answering the
counter can call without opening the bill.

There is no separate address book yet, and renaming a party never changes old
invoices.

## Quantity and units

Quantity is stored with three decimals because some units are measured, not
counted. Lokkhi enforces the difference:

| Unit type | Examples | Quantity |
| --- | --- | --- |
| Counted | `pcs`, `box`, `packet`, `dozen` | Whole numbers only |
| Measured | `kg`, `g`, `litre`, `ml` | Fractions allowed |

So `2 pcs` and `1.5 kg` are both valid, while `2.5 pcs` is rejected in the
editor and by the API. If you switch a line from `kg` to `pcs`, Lokkhi rounds the
quantity to a whole number instead of leaving an invalid fraction behind.

## Appearance

The header and the sign-in page have a three-way switch: **Light**, **Dark** and
**System**. System follows the device setting and updates live when the device
changes. The choice is remembered per browser and applied before the page paints,
so there is no white flash when you open a dark-themed app.
