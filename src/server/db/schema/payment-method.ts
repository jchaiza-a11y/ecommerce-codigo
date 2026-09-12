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
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./user";

/**
 * Tarjetas guardadas del cliente (010). Solo se persiste lo que Stripe expone de
 * `payment_method.card`: `brand`, `last4` y la caducidad. El PAN completo, el
 * BIN/IIN y el CVC nunca salen de Stripe (PCI-DSS), así que aquí no hay nada
 * que cifrar: el dato sensible es el `stripe_payment_method_id`, que identifica
 * la tarjeta en Stripe y jamás se serializa al cliente.
 *
 * `stripe_payment_method_id` es único porque el alta llega por dos caminos a la
 * vez —el retorno del usuario y el webhook `checkout.session.completed`— y la
 * idempotencia sale del índice + `onConflictDoUpdate`, no de un "comprobar y
 * luego insertar" (010 §Notas).
 */
export const paymentMethod = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripePaymentMethodId: varchar("stripe_payment_method_id", { length: 255 })
      .notNull()
      .unique(),
    brand: varchar("brand", { length: 32 }).notNull(),
    last4: varchar("last4", { length: 4 }).notNull(),
    expMonth: integer("exp_month").notNull(),
    expYear: integer("exp_year").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("payment_methods_user_created_idx").on(t.userId, desc(t.createdAt)),
    check(
      "payment_methods_exp_month_valid",
      sql`${t.expMonth} between 1 and 12`,
    ),
  ],
);

export type PaymentMethod = InferSelectModel<typeof paymentMethod>;
export type NewPaymentMethod = InferInsertModel<typeof paymentMethod>;
