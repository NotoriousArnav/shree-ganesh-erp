# Dashboard

The Dashboard is the first screen after signing in. It answers two questions:

- *What needs my attention right now?* — stock health, low stock, stock value.
- *What moved during the period I care about?* — movements, trend and recent
  activity for any date range.

![Dashboard](../assets/screenshots/dashboard.png)

## Choosing a period

The panel at the top sets one range for every movement widget. Stock totals and
valuation are always current — they are not historical.

- **Presets** — Today, 7 days, 30 days and This month. These start at local
  midnight and end now.
- **From / To editors** — Pick a date and a time. Times include seconds.
- **Previous / Next** — Shifts the whole window by its own length. A 7-day
  window moves back or forward exactly seven days.
- **Swipe** — On a phone or tablet, swipe left or right across the widgets to
  move the window. Swiping is disabled while customising.

The range is shown in two ways:

- The canonical form, `HH:MM:SS@DD/MM/YYYY#Weekday`, for example
  `14:30:00@05/11/2026#Thursday`.
- A fluent label, for example *Thursday, 5 November 2026 at 2:30:00 pm*.

The range must end after it starts and cannot be longer than 366 days. The
Dashboard stops and explains the problem instead of querying an invalid range.

> The API stores and transports Unix epoch seconds. The date/time text is only a
> presentation layer; switching time zones or changing the format does not
> change the data.

## Widgets

Each widget can be reordered or hidden. The defaults are:

| Widget | What it shows |
| --- | --- |
| **Inventory** | Active product definitions. The hint shows archived products and the number of categories. |
| **Low stock** | Active products at or below their reorder level. |
| **Stock value (cost)** | `on-hand × purchase price`, with retail value and potential margin in the hint. |
| **Movements in range** | Quantity in and out for the selected period, plus the number of movements. |
| **Stock health** | A bar splitting active products into healthy, low and out of stock. |
| **Movement trend** | Daily in/out bars for the period. |
| **Needs reordering** | Up to eight products at or below their reorder level. |
| **Recent movements** | The eight newest movements in the period. |
| **Category value** | Cost and retail stock value per category. |
| **Top stock value** | The five products holding the most retail value. |

Notes:

- A reorder level of `0` means "do not warn", so those products never appear in
  the low-stock count.
- Values are converted to the shop currency from **Settings**.
- Totals use current stock rows, not historical cost layers.

## Rearranging and hiding widgets

Choose **Customise** to enter layout mode. Every widget gets a drag handle and a
hide button.

- Drag a widget by its handle to move it. The order is saved as you drop it.
- Choose **Hide** to remove a widget from the Dashboard. Hidden widgets appear
  in the **Hidden widgets** strip; choose one there to bring it back.
- Choose **Reset layout** to restore the default order and show everything
  again.
- Choose **Done** to leave layout mode.

The layout belongs to the shop and is stored in this browser
(`localStorage`, key `mushak.dashboard.layout.v1:<merchantId>`). Another
browser or another shop starts from the default layout. Hiding a widget does not
delete any data.

## Refresh

The Dashboard does not poll. Choose **Refresh** after someone else records
stock or changes products, or change the period to fetch again.

## Print a shop report

Choose **Report** in the Dashboard header to open the printable report. It uses
its own range, defaults to the last 30 days, and can be printed or saved as a
PDF. See [Report](12-report.md).

## Who can see it

Every signed-in shop account can open the Dashboard. Staff see the same shop
totals; there is no per-staff filtering.
