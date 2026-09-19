import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { category } from "./category";

export const product = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    sku: varchar("sku", { length: 40 }).notNull(),
    description: text("description"),
    brand: varchar("brand", { length: 60 }),
    priceCents: integer("price_cents").notNull(),
    compareAtPriceCents: integer("compare_at_price_cents"),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Únicos parciales: un producto con soft delete libera su slug y su SKU,
    // así que el admin puede reutilizarlos o recrear el producto.
    uniqueIndex("products_slug_unique")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("products_sku_unique")
      .on(t.sku)
      .where(sql`${t.deletedAt} is null`),
    index("products_category_idx").on(t.categoryId),
    index("products_active_created_idx").on(t.isActive, t.createdAt),
    check("products_price_cents_non_negative", sql`${t.priceCents} >= 0`),
    check(
      "products_compare_at_price_cents_non_negative",
      sql`${t.compareAtPriceCents} is null or ${t.compareAtPriceCents} >= 0`,
    ),
    check("products_stock_non_negative", sql`${t.stock} >= 0`),
    check(
      "products_low_stock_threshold_non_negative",
      sql`${t.lowStockThreshold} >= 0`,
    ),
  ],
);

export type Product = InferSelectModel<typeof product>;
export type NewProduct = InferInsertModel<typeof product>;
