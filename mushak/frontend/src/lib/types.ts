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

export type Product = {
  id: string;
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

export type DashboardData = {
  merchant: Merchant | null;
  counts: {
    products: number;
    activeProducts: number;
    categories: number;
    lowStock: number;
  };
  value: {
    cost: number;
    retail: number;
    currency: string;
  };
  today: {
    movements: number;
    inQty: number;
    outQty: number;
  };
  lowStock: Array<{
    id: string;
    name: string;
    unit: string;
    stockQty: number;
    reorderLevel: number;
  }>;
  recentMovements: Movement[];
};
