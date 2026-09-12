import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { order } from "./order";
import { product } from "./product";

/**
 * Detalle del pedido con el precio congelado (008): `product_name` y
 * `unit_price_cents` son un snapshot del momento de la compra y no se releen
 * nunca desde `products`, que puede cambiar de precio, de nombre o retirarse.
 *
 * `onDelete: restrict` en `product_id` porque `products` usa soft delete: la
 * fila sobrevive y el histórico del pedido conserva su referencia.
 */
export const orderItem = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    productName: varchar("product_name", { length: 140 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check(
      "order_items_unit_price_cents_non_negative",
      sql`${t.unitPriceCents} >= 0`,
    ),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

export type OrderItem = InferSelectModel<typeof orderItem>;
export type NewOrderItem = InferInsertModel<typeof orderItem>;
