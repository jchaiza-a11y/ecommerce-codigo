import {
  desc,
  sql,
  type InferInsertModel,
  type InferSelectModel,
} from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./user";

export const orderStatus = pgEnum("order_status", [
  "pending", // Checkout Session creada, esperando el pago
  "paid", // confirmado por webhook, nunca por la página de éxito
  "failed", // async_payment_failed o sesión expirada
  "canceled",
]);

/**
 * Cabecera del pedido (008). `stripe_checkout_session_id` es notNull y único:
 * es la clave con la que el webhook reconcilia el evento contra el pedido, y el
 * único que evita que dos pedidos cuelguen de la misma sesión.
 */
export const order = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    status: orderStatus("status").notNull().default("pending"),
    // Total congelado al crear la sesión: recalcularlo desde `products` daría
    // otro número en cuanto el admin toque un precio.
    totalCents: integer("total_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("eur"),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", {
      length: 255,
    })
      .notNull()
      .unique(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("orders_user_created_idx").on(t.userId, desc(t.createdAt)),
    check("orders_total_cents_non_negative", sql`${t.totalCents} >= 0`),
  ],
);

export type Order = InferSelectModel<typeof order>;
export type NewOrder = InferInsertModel<typeof order>;
export type OrderStatus = Order["status"];
