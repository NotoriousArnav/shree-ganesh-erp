# Exporting an invoice

Open an invoice and choose **Export**. Pick a format, and Lokkhi prepares the
file from the invoice on screen.

| Format | Best for |
| --- | --- |
| **CSV** | Spreadsheets, accounting scripts, or importing into another tool |
| **XLSX** | Excel, with an `Invoice` summary sheet and an `Items` sheet |
| **PDF** | Sending a finished A4 document to a customer or supplier |

Every format uses the same snapshot as the invoice page: names, quantities,
prices, discounts and tax never change because Mushak changed later.

## The export window

After choosing a format, a small window shows the file name and size. The
download starts by itself after five seconds, which leaves time to read the
details or cancel. **Download now** starts it immediately.

**Share to…** opens the device share sheet with the file attached when the
browser supports it. If it does not — most desktop browsers — Lokkhi shows
WhatsApp, Telegram and email links plus **Copy details**, so the invoice summary
and link can be pasted anywhere. Download the file first if you want to attach
it to those messages.

Shared links point to a read-only copy at
`<your Lokkhi address>/invoices/<id>?anon=true`. The recipient does not need an
account and sees the same invoice document, with **Print** and **Export** but no
edit controls. Treat the link like the invoice itself: anyone who has it can
read it.

## What is included

- invoice number, kind, status, dates and notes
- customer or supplier name, phone and GSTIN
- every line with SKU, HSN, unit, quantity, price, discount and tax
- subtotal, discount, tax and total

The PDF is A4 portrait, repeats its table heading on every page, and keeps the
totals at the end even for long invoices.

## Notes

- Drafts export too; they show `Draft — not numbered yet` instead of a number.
- Exports are generated in the browser. The invoice is not uploaded anywhere to
  make a file.
- PDF text uses the standard Latin fonts, so characters outside that set appear
  as `?`. CSV and XLSX keep the original text exactly.
