CREATE TYPE "public"."finance_expense_category" AS ENUM('alquiler', 'servicios', 'marketing', 'personal', 'otro');--> statement-breakpoint
CREATE TYPE "public"."finance_expense_origin" AS ENUM('order_cogs', 'order_shipping', 'manual');--> statement-breakpoint
CREATE TYPE "public"."finance_income_category" AS ENUM('venta_extra', 'financiero', 'otro');--> statement-breakpoint
CREATE TYPE "public"."finance_income_origin" AS ENUM('order', 'manual');--> statement-breakpoint
CREATE TABLE "finance_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin" "finance_expense_origin" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" varchar(200),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid,
	"category" "finance_expense_category",
	"metadata" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_expense_amount_cents_non_negative" CHECK ("finance_expense"."amount_cents" >= 0),
	CONSTRAINT "finance_expense_origin_coherent" CHECK (("finance_expense"."origin" in ('order_cogs', 'order_shipping') and "finance_expense"."order_id" is not null and "finance_expense"."category" is null)
          or ("finance_expense"."origin" = 'manual' and "finance_expense"."order_id" is null and "finance_expense"."category" is not null))
);
--> statement-breakpoint
CREATE TABLE "finance_income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin" "finance_income_origin" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" varchar(200),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid,
	"category" "finance_income_category",
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_income_amount_cents_non_negative" CHECK ("finance_income"."amount_cents" >= 0),
	CONSTRAINT "finance_income_origin_coherent" CHECK (("finance_income"."origin" = 'order' and "finance_income"."order_id" is not null and "finance_income"."category" is null)
          or ("finance_income"."origin" = 'manual' and "finance_income"."order_id" is null and "finance_income"."category" is not null))
);
--> statement-breakpoint
CREATE TABLE "finance_settings" (
	"id" smallint PRIMARY KEY NOT NULL,
	"shipping_cost_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_settings_singleton" CHECK ("finance_settings"."id" = 1),
	CONSTRAINT "finance_settings_shipping_cost_cents_non_negative" CHECK ("finance_settings"."shipping_cost_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_cents" integer;--> statement-breakpoint
ALTER TABLE "finance_expense" ADD CONSTRAINT "finance_expense_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expense" ADD CONSTRAINT "finance_expense_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_income" ADD CONSTRAINT "finance_income_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_income" ADD CONSTRAINT "finance_income_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_expense_order_origin_unique" ON "finance_expense" USING btree ("order_id","origin") WHERE "finance_expense"."origin" in ('order_cogs', 'order_shipping');--> statement-breakpoint
CREATE UNIQUE INDEX "finance_income_order_unique" ON "finance_income" USING btree ("order_id") WHERE "finance_income"."origin" = 'order';--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_cost_cents_non_negative" CHECK ("products"."cost_cents" is null or "products"."cost_cents" >= 0);--> statement-breakpoint
-- Fila singleton de `finance_settings` (014 T6). Va aquí y no en `seed.ts`
-- porque es un dato de sistema, no de RBAC ni de demostración: sin ella el
-- fulfillment no tendría tarifa de envío que leer.
INSERT INTO "finance_settings" ("id", "shipping_cost_cents") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;