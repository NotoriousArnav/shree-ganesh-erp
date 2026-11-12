export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  productCount: number;
};

/** Mirrors staff_permission values from the backend. */
export const staffPermissionValues = [
  "stock",
  "catalogue",
  "categories",
] as const;

export type StaffPermission = (typeof staffPermissionValues)[number];

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  permissions: StaffPermission[];
  active: boolean;
  createdAt: string;
};

/**
 * A flattened product row: catalogue definition joined with its stock row.
 *
 * `id` is whichever row the list is about — the inventory row on the Inventory
 * tab, the catalogue definition on the Catalogue tab. `catalogueItemId` and
 * `inventoryItemId` are always the two underlying ids.
 */
export type Product = {
  id: string;
  catalogueItemId: string;
  inventoryItemId: string | null;
  merchantId: string;
  categoryId: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  hsnCode: string | null;
  taxRate: number;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
  reorderLevel: number;
  /** Catalogue definition image. */
  imageKey: string | null;
  /** Stock-row image; falls back to the catalogue image when empty. */
  inventoryImageKey: string | null;
  attributes: Record<string, string> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName: string | null;
};

export type Movement = {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  type: string;
  quantity: number;
  unitCost: number | null;
  note: string | null;
  createdAt: string;
};

export type Merchant = {
  id: string;
  name: string;
  slug: string;
  gstin: string | null;
  phone: string | null;
  currency: string;
  address: Record<string, string> | null;
  profileImageKey: string | null;
};

export type Profile = {
  merchant: Merchant | null;
  user: {
    id: string;
    name: string;
    role: string;
    permissions: StaffPermission[];
  };
};

export type EpochRange = {
  from: number;
  to: number;
};

export type CategoryValue = {
  id: string | null;
  name: string;
  products: number;
  cost: number;
  retail: number;
};

export type TopValueProduct = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  cost: number;
  retail: number;
};

export type StockHealth = {
  outOfStock: number;
  low: number;
  healthy: number;
};

export type PeriodSummary = {
  movements: number;
  inQty: number;
  outQty: number;
};

export type MovementSeriesPoint = {
  date: string;
  inQty: number;
  outQty: number;
};

export type LowStockItem = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  reorderLevel: number;
};

export type OutOfStockItem = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  updatedAt: string;
};

type ShopTotals = {
  counts: {
    products: number;
    activeProducts: number;
    categories: number;
    lowStock: number;
  };
  value: {
    cost: number;
    retail: number;
    margin: number;
    currency: string;
  };
  stockHealth: StockHealth;
  categories: CategoryValue[];
  topValue: TopValueProduct[];
};

export type DashboardData = ShopTotals & {
  merchant: Merchant | null;
  range: EpochRange;
  period: EpochRange &
    PeriodSummary & {
      series: MovementSeriesPoint[];
    };
  lowStock: LowStockItem[];
  recentMovements: Movement[];
};

export type ShopReportData = ShopTotals & {
  merchant: Merchant | null;
  generatedAt: string;
  generatedBy: string;
  range: EpochRange;
  period: EpochRange & PeriodSummary;
  lowStock: LowStockItem[];
  outOfStock: OutOfStockItem[];
  movements: Movement[];
  movementTotal: number;
  truncated: boolean;
};
