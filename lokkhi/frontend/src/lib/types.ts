export type InvoiceKind = "sale" | "purchase";
export type InvoiceStatus = "draft" | "issued" | "void";
export type LineStatus = "linked" | "missing" | "archived";
export type StockSyncState = "not_applicable" | "synced" | "failed";

export type InvoiceLine = {
  id: string;
  invoiceId: string;
  position: number;
  catalogueItemId: string | null;
  itemName: string;
  sku: string | null;
  hsnCode: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineSubtotal: number;
  lineTaxable: number;
  lineTax: number;
  lineTotal: number;
  stockMovementId: string | null;
  stockSyncState: StockSyncState;
  stockSyncNote: string | null;
  lineStatus: LineStatus;
  catalogueItem: {
    id: string;
    name: string;
    isActive: boolean;
    stockQty: number;
  } | null;
};

export type Invoice = {
  id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  number: string | null;
  financialYear: string | null;
  invoiceDate: string;
  dueDate: string | null;
  partyName: string;
  partyPhone: string | null;
  partyGstin: string | null;
  partyAddress: Record<string, string> | null;
  currency: string;
  notes: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  issuedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: InvoiceLine[];
};

export type InvoiceListItem = Omit<Invoice, "lines"> & {
  manualItemCount: number;
  stockFailedCount: number;
};

export type Suggestion = {
  id: string;
  name: string;
  sku: string | null;
  hsnCode: string | null;
  unit: string;
  taxRate: number;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
};

export type InvoiceLinePayload = {
  catalogueItemId?: string | null;
  itemName: string;
  sku?: string | null;
  hsnCode?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

export type InvoicePayload = {
  kind: InvoiceKind;
  invoiceDate: string;
  dueDate?: string | null;
  partyName: string;
  partyPhone?: string | null;
  partyGstin?: string | null;
  notes?: string | null;
  lines: InvoiceLinePayload[];
};
