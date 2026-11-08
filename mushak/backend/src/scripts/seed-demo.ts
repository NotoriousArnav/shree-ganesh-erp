import "dotenv/config";
import { and, eq } from "drizzle-orm";

import { db, client } from "../db.js";
import {
  catalogueItems,
  categories,
  inventoryItems,
  merchants,
  stockMovements,
  users,
} from "../db/schema.js";

/**
 * Seeds a demo shop: merchant, two logins, categories and a small catalogue.
 *
 * Idempotent: existing rows are matched by slug, email or SKU and left alone.
 * All names, numbers and addresses here are fictional demo data.
 *
 *   npm run seed:demo
 */
process.env.ALLOW_SIGNUP = "true";

const MERCHANT = {
  name: "Ganesh Kirana",
  slug: "ganesh-kirana",
  phone: "+919876543210",
  currency: "INR",
  address: {
    line1: "12 Market Road (demo address)",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
  },
};

const ACCOUNTS = [
  {
    email: "merchant@mushak.local",
    password: "merchant-pass-123",
    name: "Shop Owner",
    role: "merchant",
    phone: "+919876543210",
  },
  {
    email: "staff@mushak.local",
    password: "staff-pass-123",
    name: "Counter Staff",
    role: "staff",
    phone: "+919876543211",
  },
] as const;

const CATEGORY_NAMES = [
  "Grains & Pulses",
  "Dairy",
  "Snacks & Biscuits",
  "Beverages",
  "Household",
];

const CATALOGUE = [
  {
    name: "Basmati Rice 5 kg",
    sku: "RICE-BAS-5",
    category: "Grains & Pulses",
    unit: "pcs",
    hsn: "1006",
    tax: 5,
    purchase: 480,
    selling: 560,
    stock: 18,
    reorder: 5,
  },
  {
    name: "Toor Dal 1 kg",
    sku: "DAL-TOOR-1",
    category: "Grains & Pulses",
    unit: "pcs",
    hsn: "0713",
    tax: 5,
    purchase: 130,
    selling: 155,
    stock: 25,
    reorder: 10,
  },
  {
    name: "Amul Taaza Milk 500 ml",
    sku: "MILK-AMUL-500",
    category: "Dairy",
    unit: "pcs",
    hsn: "0401",
    tax: 0,
    purchase: 27,
    selling: 30,
    stock: 30,
    reorder: 12,
  },
  {
    name: "Britannia Good Day 200 g",
    sku: "BISC-GD-200",
    category: "Snacks & Biscuits",
    unit: "pcs",
    hsn: "1905",
    tax: 18,
    purchase: 35,
    selling: 45,
    stock: 40,
    reorder: 10,
  },
  {
    name: "Tata Salt 1 kg",
    sku: "SALT-TATA-1",
    category: "Grains & Pulses",
    unit: "pcs",
    hsn: "2501",
    tax: 0,
    purchase: 22,
    selling: 28,
    stock: 30,
    reorder: 10,
  },
  {
    name: "Sunflower Oil 1 L",
    sku: "OIL-SUN-1",
    category: "Grains & Pulses",
    unit: "litre",
    hsn: "1512",
    tax: 5,
    purchase: 135,
    selling: 160,
    stock: 12,
    reorder: 6,
  },
  {
    name: "Maggi Noodles 12-pack",
    sku: "MAGGI-12",
    category: "Snacks & Biscuits",
    unit: "packet",
    hsn: "1902",
    tax: 18,
    purchase: 150,
    selling: 180,
    stock: 8,
    reorder: 4,
  },
  {
    name: "Surf Excel 1 kg",
    sku: "DET-SURF-1",
    category: "Household",
    unit: "pcs",
    hsn: "3402",
    tax: 18,
    purchase: 180,
    selling: 210,
    stock: 6,
    reorder: 5,
  },
  {
    name: "Colgate 100 g",
    sku: "PASTE-COL-100",
    category: "Household",
    unit: "pcs",
    hsn: "3306",
    tax: 18,
    purchase: 55,
    selling: 65,
    stock: 3,
    reorder: 6,
  },
  {
    name: "Parle-G 100 g",
    sku: "BISC-PG-100",
    category: "Snacks & Biscuits",
    unit: "pcs",
    hsn: "1905",
    tax: 18,
    purchase: 10,
    selling: 12,
    stock: 50,
    reorder: 20,
  },
];

const { auth } = await import("../auth.js");

let [merchant] = await db
  .select()
  .from(merchants)
  .where(eq(merchants.slug, MERCHANT.slug))
  .limit(1);

if (!merchant) {
  [merchant] = await db.insert(merchants).values(MERCHANT).returning();
  console.log(`Created merchant ${merchant.name} (${merchant.slug}).`);
} else {
  console.log(`Merchant ${merchant.name} already exists.`);
}

for (const account of ACCOUNTS) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, account.email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        name: account.name,
        role: account.role,
        merchantId: merchant.id,
        phoneNumber: account.phone,
        banned: false,
      })
      .where(eq(users.id, existing.id));
    console.log(`Updated ${account.email} (${account.role}).`);
    continue;
  }

  await auth.api.signUpEmail({
    body: {
      email: account.email,
      password: account.password,
      name: account.name,
    },
  });

  await db
    .update(users)
    .set({
      role: account.role,
      merchantId: merchant.id,
      phoneNumber: account.phone,
      emailVerified: true,
    })
    .where(eq(users.email, account.email));

  console.log(`Created ${account.email} (${account.role}).`);
}

const categoryIds = new Map<string, string>();

for (const name of CATEGORY_NAMES) {
  const [existing] = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.merchantId, merchant.id), eq(categories.name, name)),
    )
    .limit(1);

  if (existing) {
    categoryIds.set(name, existing.id);
    continue;
  }

  const [created] = await db
    .insert(categories)
    .values({ merchantId: merchant.id, name })
    .returning();

  categoryIds.set(name, created.id);
  console.log(`Created category ${name}.`);
}

let createdProducts = 0;

for (const item of CATALOGUE) {
  const [existing] = await db
    .select({ id: catalogueItems.id })
    .from(catalogueItems)
    .where(
      and(
        eq(catalogueItems.merchantId, merchant.id),
        eq(catalogueItems.sku, item.sku),
      ),
    )
    .limit(1);

  if (existing) continue;

  await db.transaction(async (tx) => {
    const [catalogue] = await tx
      .insert(catalogueItems)
      .values({
        merchantId: merchant.id,
        categoryId: categoryIds.get(item.category) ?? null,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        hsnCode: item.hsn,
        taxRate: item.tax,
        purchasePrice: item.purchase,
        sellingPrice: item.selling,
      })
      .returning();

    const [stock] = await tx
      .insert(inventoryItems)
      .values({
        merchantId: merchant.id,
        catalogueItemId: catalogue.id,
        stockQty: item.stock,
        reorderLevel: item.reorder,
      })
      .returning();

    if (item.stock > 0) {
      await tx.insert(stockMovements).values({
        merchantId: merchant.id,
        inventoryItemId: stock.id,
        type: "adjustment",
        quantity: item.stock,
        unitCost: item.purchase,
        note: "Opening stock (demo)",
      });
    }
  });

  createdProducts += 1;
}

console.log(
  `Catalogue: ${createdProducts} new product(s), ${CATALOGUE.length - createdProducts} already present.`,
);
console.log("");
console.log("Sign in at http://localhost:5173/login");
console.log("  merchant@mushak.local / merchant-pass-123  (owner)");
console.log("  staff@mushak.local    / staff-pass-123     (counter)");
console.log("  or by phone: +919876543210 / +919876543211");
console.log("");
console.log("All shop data above is fictional demo data.");

await client.end();
