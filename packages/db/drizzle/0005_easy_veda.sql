CREATE TYPE "public"."invoice_kind" AS ENUM('sale', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."invoice_line_stock_state" AS ENUM('not_applicable', 'synced', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'void');--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"catalogue_item_id" uuid,
	"item_name" text NOT NULL,
	"sku" text,
	"hsn_code" text,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT 0 NOT NULL,
	"line_subtotal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"line_taxable" numeric(12, 2) DEFAULT 0 NOT NULL,
	"line_tax" numeric(12, 2) DEFAULT 0 NOT NULL,
	"line_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"stock_movement_id" uuid,
	"stock_sync_state" "invoice_line_stock_state" DEFAULT 'not_applicable' NOT NULL,
	"stock_sync_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"kind" "invoice_kind" NOT NULL,
	"financial_year" text NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"kind" "invoice_kind" NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"number" text,
	"financial_year" text,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"party_name" text NOT NULL,
	"party_phone" text,
	"party_gstin" text,
	"party_address" jsonb,
	"currency" text DEFAULT 'INR' NOT NULL,
	"notes" text,
	"subtotal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_catalogue_item_id_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE INDEX "invoice_lines_catalogue_idx" ON "invoice_lines" USING btree ("catalogue_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_sequences_merchant_kind_year_idx" ON "invoice_sequences" USING btree ("merchant_id","kind","financial_year");--> statement-breakpoint
CREATE INDEX "invoices_merchant_date_idx" ON "invoices" USING btree ("merchant_id","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_merchant_status_idx" ON "invoices" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_merchant_number_idx" ON "invoices" USING btree ("merchant_id","number");