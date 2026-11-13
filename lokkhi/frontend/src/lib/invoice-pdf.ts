import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { plainMoney } from "./invoice-export";
import type { Invoice } from "./types";

/**
 * A4 invoice PDF, drawn directly with pdf-lib.
 *
 * The layout mirrors the printed invoice: header, party block, item table,
 * totals and notes. Long item names wrap instead of overflowing, and tables
 * continue on a new page when needed.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const BOTTOM = 72;

const ink = rgb(0.07, 0.07, 0.08);
const muted = rgb(0.38, 0.38, 0.42);
const rule = rgb(0.82, 0.82, 0.85);
const soft = rgb(0.95, 0.95, 0.96);

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Standard PDF fonts are Latin-1, so unsupported glyphs become '?'. */
function safeText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "?")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safeText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushChunked = (word: string) => {
    let chunk = "";
    for (const character of word) {
      const next = chunk + character;
      if (chunk && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = next;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    current = pushChunked(word);
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawRight(
  page: PDFPage,
  font: PDFFont,
  size: number,
  value: string,
  right: number,
  y: number,
  color = ink,
) {
  const text = safeText(value);
  page.drawText(text, {
    x: right - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color,
  });
}

const columns = [
  { key: "item", label: "Item", width: 180, align: "left" as const },
  { key: "qty", label: "Qty", width: 45, align: "right" as const },
  { key: "price", label: "Price", width: 70, align: "right" as const },
  { key: "discount", label: "Disc.", width: 55, align: "right" as const },
  { key: "tax", label: "Tax", width: 76, align: "right" as const },
  { key: "total", label: "Total", width: 81, align: "right" as const },
];

const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);

function columnX(offsetFromLeft: number) {
  return MARGIN + offsetFromLeft;
}

type Cursor = { page: PDFPage; y: number };

function drawTableHead(cursor: Cursor, fonts: Fonts) {
  const { page } = cursor;
  const height = 20;
  page.drawRectangle({
    x: MARGIN,
    y: cursor.y - height + 6,
    width: tableWidth,
    height,
    color: soft,
  });

  let offset = 0;
  for (const column of columns) {
    const label = column.label;
    if (column.align === "right") {
      const right = columnX(offset) + column.width;
      drawRight(page, fonts.bold, 8, label, right, cursor.y - height + 12, muted);
    } else {
      page.drawText(label, {
        x: columnX(offset) + 6,
        y: cursor.y - height + 12,
        size: 8,
        font: fonts.bold,
        color: muted,
      });
    }
    offset += column.width;
  }

  cursor.y -= height + 2;
  page.drawLine({
    start: { x: MARGIN, y: cursor.y + 2 },
    end: { x: MARGIN + tableWidth, y: cursor.y + 2 },
    thickness: 0.6,
    color: rule,
  });
}

function lineMeta(invoice: Invoice, index: number) {
  const line = invoice.lines[index];
  return [line.sku ? `SKU ${line.sku}` : null, line.hsnCode ? `HSN ${line.hsnCode}` : null]
    .filter(Boolean)
    .join(" · ");
}

function clipLines(lines: string[], limit: number) {
  if (lines.length <= limit) return lines;
  const clipped = lines.slice(0, limit);
  clipped[limit - 1] = `${clipped[limit - 1]}...`.slice(0, 80);
  return clipped;
}

function lineRowHeight(fonts: Fonts, invoice: Invoice, index: number) {
  const line = invoice.lines[index];
  const itemWidth = columns[0].width - 12;
  const nameLines = clipLines(wrap(line.itemName, fonts.regular, 9, itemWidth), 5);
  const meta = lineMeta(invoice, index);
  const metaLines = clipLines(meta ? wrap(meta, fonts.regular, 7.5, itemWidth) : [], 2);
  return nameLines.length * 11 + metaLines.length * 9 + 10;
}

function drawLineRow(cursor: Cursor, fonts: Fonts, invoice: Invoice, index: number) {
  const line = invoice.lines[index];
  const itemWidth = columns[0].width - 12;
  const nameLines = clipLines(wrap(line.itemName, fonts.regular, 9, itemWidth), 5);
  const meta = lineMeta(invoice, index);
  const metaLines = clipLines(meta ? wrap(meta, fonts.regular, 7.5, itemWidth) : [], 2);
  const rowHeight = nameLines.length * 11 + metaLines.length * 9 + 10;

  let y = cursor.y - 12;
  for (const text of nameLines) {
    cursor.page.drawText(text, {
      x: columnX(0) + 6,
      y,
      size: 9,
      font: fonts.regular,
      color: ink,
    });
    y -= 11;
  }
  for (const text of metaLines) {
    cursor.page.drawText(text, {
      x: columnX(0) + 6,
      y,
      size: 7.5,
      font: fonts.regular,
      color: muted,
    });
    y -= 9;
  }

  const values = [
    `${line.quantity} ${line.unit}`,
    plainMoney(line.unitPrice, invoice.currency),
    line.discount ? `-${plainMoney(line.discount, invoice.currency)}` : "-",
    `${line.taxRate}%`,
    plainMoney(line.lineTotal, invoice.currency),
  ];

  let offset = columns[0].width;
  values.forEach((value, valueIndex) => {
    const column = columns[valueIndex + 1];
    drawRight(
      cursor.page,
      fonts.regular,
      8.5,
      value,
      columnX(offset) + column.width - 6,
      cursor.y - 12,
      valueIndex === values.length - 1 ? ink : muted,
    );
    offset += column.width;
  });

  cursor.y -= rowHeight;
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y + 4 },
    end: { x: MARGIN + tableWidth, y: cursor.y + 4 },
    thickness: 0.4,
    color: rule,
  });
}

export async function invoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };

  document.setTitle(
    `${invoice.kind === "sale" ? "Sale" : "Purchase"} invoice ${invoice.number ?? "draft"}`,
  );
  document.setProducer("Lokkhi");
  document.setCreator("Lokkhi");

  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cursor: Cursor = { page, y: PAGE_HEIGHT - MARGIN };

  const kind = invoice.kind === "sale" ? "Sales invoice" : "Purchase invoice";

  page.drawText(safeText(kind.toUpperCase()), {
    x: MARGIN,
    y: cursor.y - 8,
    size: 8,
    font: fonts.bold,
    color: muted,
  });
  page.drawText(safeText(invoice.number ?? "Draft - not numbered yet"), {
    x: MARGIN,
    y: cursor.y - 28,
    size: 16,
    font: fonts.bold,
    color: ink,
  });

  const meta = [
    `Date ${invoice.invoiceDate}`,
    invoice.dueDate ? `Due ${invoice.dueDate}` : null,
    `Status ${invoice.status}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  page.drawText(safeText(meta), {
    x: MARGIN,
    y: cursor.y - 44,
    size: 8.5,
    font: fonts.regular,
    color: muted,
  });

  // Party block, right aligned.
  const partyLabel = invoice.kind === "sale" ? "Billed to" : "Supplier";
  const right = MARGIN + tableWidth;
  drawRight(page, fonts.bold, 8, partyLabel.toUpperCase(), right, cursor.y - 8, muted);

  let partyY = cursor.y - 24;
  for (const text of wrap(invoice.partyName, fonts.bold, 11, 240)) {
    drawRight(page, fonts.bold, 11, text, right, partyY);
    partyY -= 13;
  }
  for (const value of [
    invoice.partyPhone,
    invoice.partyGstin ? `GSTIN ${invoice.partyGstin}` : null,
  ]) {
    if (!value) continue;
    for (const text of wrap(value, fonts.regular, 8.5, 240)) {
      drawRight(page, fonts.regular, 8.5, text, right, partyY, muted);
      partyY -= 11;
    }
  }

  cursor.y = Math.min(cursor.y - 62, partyY - 8);
  drawTableHead(cursor, fonts);

  for (let index = 0; index < invoice.lines.length; index += 1) {
    const height = lineRowHeight(fonts, invoice, index);
    if (cursor.y - height < BOTTOM) {
      const next = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.page = next;
      cursor.y = PAGE_HEIGHT - MARGIN - 8;
      drawTableHead(cursor, fonts);
    }
    drawLineRow(cursor, fonts, invoice, index);
  }

  // Totals block, right aligned to the item table.
  const totalRows: [string, string][] = [
    ["Subtotal", plainMoney(invoice.subtotal, invoice.currency)],
    ["Discount", `-${plainMoney(invoice.discountTotal, invoice.currency)}`],
    ["Tax", plainMoney(invoice.taxTotal, invoice.currency)],
  ];

  const totalsWidth = 210;
  const totalsX = MARGIN + tableWidth - totalsWidth;

  if (cursor.y - 110 < BOTTOM) {
    const next = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursor.page = next;
    cursor.y = PAGE_HEIGHT - MARGIN;
  }

  cursor.y -= 12;
  for (const [label, value] of totalRows) {
    drawRight(cursor.page, fonts.regular, 9, value, MARGIN + tableWidth - 6, cursor.y, muted);
    cursor.page.drawText(label, {
      x: totalsX,
      y: cursor.y,
      size: 9,
      font: fonts.regular,
      color: muted,
    });
    cursor.y -= 14;
  }

  cursor.page.drawLine({
    start: { x: totalsX, y: cursor.y + 6 },
    end: { x: MARGIN + tableWidth - 6, y: cursor.y + 6 },
    thickness: 0.6,
    color: rule,
  });
  cursor.page.drawText("Total", {
    x: totalsX,
    y: cursor.y - 8,
    size: 11,
    font: fonts.bold,
    color: ink,
  });
  drawRight(
    cursor.page,
    fonts.bold,
    11,
    plainMoney(invoice.total, invoice.currency),
    MARGIN + tableWidth - 6,
    cursor.y - 8,
  );
  cursor.y -= 28;

  if (invoice.notes) {
    cursor.page.drawText("Notes", {
      x: MARGIN,
      y: cursor.y - 4,
      size: 8,
      font: fonts.bold,
      color: muted,
    });
    cursor.y -= 16;
    for (const text of wrap(invoice.notes, fonts.regular, 9, tableWidth)) {
      cursor.page.drawText(text, {
        x: MARGIN,
        y: cursor.y,
        size: 9,
        font: fonts.regular,
        color: ink,
      });
      cursor.y -= 12;
    }
  }

  // Footer on every page.
  const pages = document.getPages();
  pages.forEach((current, index) => {
    current.drawText(
      safeText("Issued invoices keep the item names, prices and tax they were created with."),
      {
        x: MARGIN,
        y: 34,
        size: 7.5,
        font: fonts.regular,
        color: muted,
      },
    );
    drawRight(
      current,
      fonts.regular,
      7.5,
      `Page ${index + 1} of ${pages.length}`,
      MARGIN + tableWidth,
      34,
      muted,
    );
  });

  return document.save();
}
