import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  check,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { order } from "./order";
import { user } from "./user";

export const financeIncomeOrigin = pgEnum("finance_income_origin", [
  "order", // derivado del pedido pagado, lo escribe el fulfillment
  "manual", // alta desde el panel (CRUD de un spec futuro)
]);

/** Solo aplica a los ingresos `manual`: los de pedido se clasifican por su origen. */
export const financeIncomeCategory = pgEnum("finance_income_category", [
  "venta_extra",
  "financiero",
  "otro",
]);

/**
 * Libro de ingresos (014). Las filas de origen `order` son 100% derivadas del
 * pedido y no se editan: el ledger es el reflejo contable de la venta, no una
 * segunda fuente de verdad.
 *
 * `onDelete: restrict` en `order_id` porque un pedido con ingreso registrado no
 * puede desaparecer sin dejar el libro descuadrado.
 */
export const financeIncome = pgTable(
  "finance_income",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    origin: financeIncomeOrigin("origin").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: varchar("description", { length: 200 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    orderId: uuid("order_id").references(() => order.id, {
      onDelete: "restrict",
    }),
    category: financeIncomeCategory("category"),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Idempotencia del webhook de Stripe (AC4): un pedido no puede tener dos
    // ingresos. A diferencia del descuento de stock, aquí no hay update con
    // guarda SQL que absorba el reintento —son INSERT nuevos—, así que la
    // defensa es este índice más el `onConflictDoNothing()` del repositorio.
    uniqueIndex("finance_income_order_unique")
      .on(t.orderId)
      .where(sql`${t.origin} = 'order'`),
    check("finance_income_amount_cents_non_negative", sql`${t.amountCents} >= 0`),
    // La coherencia por origen se defiende en la base, no solo en Zod: el
    // fulfillment escribe sin pasar por un schema de entrada.
    check(
      "finance_income_origin_coherent",
      sql`(${t.origin} = 'order' and ${t.orderId} is not null and ${t.category} is null)
          or (${t.origin} = 'manual' and ${t.orderId} is null and ${t.category} is not null)`,
    ),
  ],
);

export type FinanceIncome = InferSelectModel<typeof financeIncome>;
export type NewFinanceIncome = InferInsertModel<typeof financeIncome>;
export type FinanceIncomeOrigin = FinanceIncome["origin"];
