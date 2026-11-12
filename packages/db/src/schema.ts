import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/**
 * Stock movement reasons. Generic enough for kirana, flower, mobile and
 * book shops: every change to on-hand stock is an auditable movement.
 */
export const stockMovementType = pgEnum("stock_movement_type", [
  "purchase",
  "sale",
  "return_in",
  "return_out",
  "adjustment",
  "damage",
  "transfer_in",
  "transfer_out",
]);

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    gstin: text("gstin"),
    phone: text("phone"),
    currency: text("currency").default("INR").notNull(),
    // Free-form address: line1, line2, city, state, pincode.
    address: jsonb("address").$type<Record<string, string>>(),
    /** Optional object-storage key for the shop's profile picture. */
    profileImageKey: text("profile_image_key"),
    ...timestamps,
  },
  (t) => [uniqueIndex("merchants_slug_idx").on(t.slug)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [
    index("categories_merchant_idx").on(t.merchantId),
    uniqueIndex("categories_merchant_name_idx").on(t.merchantId, t.name),
  ],
);

export const catalogueItems = pgTable(
  "catalogue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    /** pcs, kg, g, litre, ml, box, packet, dozen ... */
    unit: text("unit").default("pcs").notNull(),
    hsnCode: text("hsn_code"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    purchasePrice: numeric("purchase_price", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    sellingPrice: numeric("selling_price", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    /** Optional per-vertical fields (brand, author, size, colour, ...). */
    attributes: jsonb("attributes").$type<Record<string, string>>(),
    /** Optional object-storage key for the product picture. */
    imageKey: text("image_key"),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index("catalogue_items_merchant_idx").on(t.merchantId),
    index("catalogue_items_category_idx").on(t.categoryId),
    uniqueIndex("catalogue_items_merchant_sku_idx").on(t.merchantId, t.sku),
    uniqueIndex("catalogue_items_merchant_barcode_idx").on(
      t.merchantId,
      t.barcode,
    ),
  ],
);

/**
 * Stock state for one catalogue item.
 *
 * The catalogue owns what a product *is* (name, SKU, price, GST); this table
 * owns how much of it the shop has. Keeping them apart means a catalogue entry
 * can exist without stock and, later, one definition can have stock rows for
 * several shops or locations.
 */
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    catalogueItemId: uuid("catalogue_item_id")
      .notNull()
      .references(() => catalogueItems.id, { onDelete: "cascade" }),
    /** Cached on-hand quantity; history is kept in stock_movements. */
    stockQty: numeric("stock_qty", { precision: 14, scale: 3, mode: "number" })
      .default(0)
      .notNull(),
    reorderLevel: numeric("reorder_level", {
      precision: 14,
      scale: 3,
      mode: "number",
    })
      .default(0)
      .notNull(),
    /** Optional object-storage key for this stock row's picture. */
    imageKey: text("image_key"),
    ...timestamps,
  },
  (t) => [
    index("inventory_items_merchant_idx").on(t.merchantId),
    uniqueIndex("inventory_items_catalogue_idx").on(t.catalogueItemId),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    type: stockMovementType("type").notNull(),
    /** Signed change, e.g. +10 purchase, -2 sale. */
    quantity: numeric("quantity", { precision: 14, scale: 3, mode: "number" })
      .notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2, mode: "number" }),
    /** Links a movement to a future invoice, purchase order, etc. */
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("stock_movements_inventory_idx").on(t.inventoryItemId, t.createdAt),
    index("stock_movements_merchant_idx").on(t.merchantId),
  ],
);

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type CatalogueItem = typeof catalogueItems.$inferSelect;
export type NewCatalogueItem = typeof catalogueItems.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;

/*
 * Lokkhi: invoices.
 *
 * Invoice lines are self-contained snapshots. `catalogueItemId` is optional and
 * nullable on purpose: Mushak is a suggestion source, never a validation gate,
 * so an invoice must remain valid when the product is missing, archived or
 * deleted. Snapshot columns are therefore NOT NULL and are never rewritten when
 * the catalogue changes.
 */

export const invoiceKindValues = ["sale", "purchase"] as const;
export type InvoiceKind = (typeof invoiceKindValues)[number];
export const invoiceKind = pgEnum("invoice_kind", invoiceKindValues);

export const invoiceStatusValues = ["draft", "issued", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatusValues)[number];
export const invoiceStatus = pgEnum("invoice_status", invoiceStatusValues);

export const invoiceLineStockStateValues = [
  "not_applicable",
  "synced",
  "failed",
] as const;
export type InvoiceLineStockState =
  (typeof invoiceLineStockStateValues)[number];
export const invoiceLineStockState = pgEnum(
  "invoice_line_stock_state",
  invoiceLineStockStateValues,
);

/** One counter per shop, kind and financial year (`SALE/2026-27/0001`). */
export const invoiceSequences = pgTable(
  "invoice_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    kind: invoiceKind("kind").notNull(),
    financialYear: text("financial_year").notNull(),
    nextNumber: integer("next_number").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("invoice_sequences_merchant_kind_year_idx").on(
      t.merchantId,
      t.kind,
      t.financialYear,
    ),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    kind: invoiceKind("kind").notNull(),
    status: invoiceStatus("status").default("draft").notNull(),
    /** Null while draft; assigned atomically on issue. */
    number: text("number"),
    financialYear: text("financial_year"),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    /** Free-form party snapshot; there is no parties table in v1. */
    partyName: text("party_name").notNull(),
    partyPhone: text("party_phone"),
    partyGstin: text("party_gstin"),
    /** line1, line2, city, state, pincode. */
    partyAddress: jsonb("party_address").$type<Record<string, string>>(),
    currency: text("currency").default("INR").notNull(),
    notes: text("notes"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    discountTotal: numeric("discount_total", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    total: numeric("total", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("invoices_merchant_date_idx").on(t.merchantId, t.invoiceDate),
    index("invoices_merchant_status_idx").on(t.merchantId, t.status),
    uniqueIndex("invoices_merchant_number_idx").on(t.merchantId, t.number),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    /**
     * Optional link to Mushak. `set null` keeps the snapshot valid when the
     * product is deleted, which is exactly the redundancy rule.
     */
    catalogueItemId: uuid("catalogue_item_id").references(
      () => catalogueItems.id,
      { onDelete: "set null" },
    ),
    itemName: text("item_name").notNull(),
    sku: text("sku"),
    hsnCode: text("hsn_code"),
    unit: text("unit").default("pcs").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3, mode: "number" })
      .notNull(),
    unitPrice: numeric("unit_price", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .notNull(),
    discount: numeric("discount", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    lineSubtotal: numeric("line_subtotal", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    lineTaxable: numeric("line_taxable", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    lineTax: numeric("line_tax", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    /** Set when the issue-time best-effort stock movement succeeded. */
    stockMovementId: uuid("stock_movement_id").references(
      () => stockMovements.id,
      { onDelete: "set null" },
    ),
    stockSyncState: invoiceLineStockState("stock_sync_state")
      .default("not_applicable")
      .notNull(),
    /** Human-readable reason when stockSyncState is `failed`. */
    stockSyncNote: text("stock_sync_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("invoice_lines_invoice_idx").on(t.invoiceId, t.position),
    index("invoice_lines_catalogue_idx").on(t.catalogueItemId),
  ],
);

export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
export type NewInvoiceSequence = typeof invoiceSequences.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;

/*
 * Better Auth tables.
 *
 * Column names use snake_case; Better Auth addresses fields by the camelCase
 * property names below, so renaming a property breaks auth. Table names are
 * plural and mapped through `modelName` in src/auth.ts.
 */

export const userRoleValues = [
  "super_admin",
  "dev",
  "merchant",
  "staff",
] as const;

export type UserRole = (typeof userRoleValues)[number];

/**
 * What a staff account may change.
 *
 * Merchants implicitly have every permission; this list only limits staff.
 * Reading products, categories and the dashboard is always allowed so staff
 * can look things up at the counter.
 *
 * - stock:     record stock movements
 * - catalogue: add, edit, archive and price products
 * - categories: create, rename and delete categories
 */
export const staffPermissionValues = [
  "stock",
  "catalogue",
  "categories",
] as const;

export type StaffPermission = (typeof staffPermissionValues)[number];

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role").default("staff").notNull(),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").default(false),
    /** Set for merchant-scoped accounts (merchant, staff). */
    merchantId: uuid("merchant_id").references(() => merchants.id, {
      onDelete: "cascade",
    }),
    /**
     * Staff-only limits. Merchants ignore this column and always have all
     * permissions. Existing staff default to stock access.
     */
    staffPermissions: jsonb("staff_permissions")
      .$type<StaffPermission[]>()
      .default(sql`'["stock"]'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_phone_number_idx").on(t.phoneNumber),
    index("users_merchant_idx").on(t.merchantId),
    check(
      "users_role_check",
      sql`${t.role} in ('super_admin', 'dev', 'merchant', 'staff')`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    impersonatedBy: text("impersonated_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.token),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;

