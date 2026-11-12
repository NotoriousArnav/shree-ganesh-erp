ALTER TABLE "products" RENAME TO "catalogue_items";--> statement-breakpoint
ALTER TABLE "catalogue_items" RENAME CONSTRAINT "products_merchant_id_merchants_id_fk" TO "catalogue_items_merchant_id_merchants_id_fk";--> statement-breakpoint
ALTER TABLE "catalogue_items" RENAME CONSTRAINT "products_category_id_categories_id_fk" TO "catalogue_items_category_id_categories_id_fk";--> statement-breakpoint
ALTER INDEX "products_merchant_idx" RENAME TO "catalogue_items_merchant_idx";--> statement-breakpoint
ALTER INDEX "products_category_idx" RENAME TO "catalogue_items_category_idx";--> statement-breakpoint
ALTER INDEX "products_merchant_sku_idx" RENAME TO "catalogue_items_merchant_sku_idx";--> statement-breakpoint
ALTER INDEX "products_merchant_barcode_idx" RENAME TO "catalogue_items_merchant_barcode_idx";--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"catalogue_item_id" uuid NOT NULL,
	"stock_qty" numeric(14, 3) DEFAULT 0 NOT NULL,
	"reorder_level" numeric(14, 3) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_catalogue_item_id_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_catalogue_idx" ON "inventory_items" USING btree ("catalogue_item_id");--> statement-breakpoint
CREATE INDEX "inventory_items_merchant_idx" ON "inventory_items" USING btree ("merchant_id");--> statement-breakpoint
INSERT INTO "inventory_items" ("merchant_id", "catalogue_item_id", "stock_qty", "reorder_level", "created_at", "updated_at")
SELECT "merchant_id", "id", "stock_qty", "reorder_level", "created_at", "updated_at" FROM "catalogue_items";--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "inventory_item_id" uuid;--> statement-breakpoint
UPDATE "stock_movements"
SET "inventory_item_id" = "inventory_items"."id"
FROM "inventory_items"
WHERE "inventory_items"."catalogue_item_id" = "stock_movements"."product_id";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_product_id_products_id_fk";--> statement-breakpoint
DROP INDEX "stock_movements_product_idx";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "inventory_item_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_inventory_idx" ON "stock_movements" USING btree ("inventory_item_id", "created_at");--> statement-breakpoint
ALTER TABLE "catalogue_items" DROP COLUMN "stock_qty";--> statement-breakpoint
ALTER TABLE "catalogue_items" DROP COLUMN "reorder_level";
