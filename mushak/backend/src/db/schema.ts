import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
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

