import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { order } from "./order";
import { user } from "./user";

export const financeExpenseOrigin = pgEnum("finance_expense_origin", [
  "order_cogs", // costo de la mercadería vendida, agregado por pedido
  "order_shipping", // tarifa de envío vigente al pagar
  "manual", // alta desde el panel (CRUD de un spec futuro)
]);

/** Solo aplica a los egresos `manual`: los de pedido se clasifican por su origen. */
export const financeExpenseCategory = pgEnum("finance_expense_category", [
  "alquiler",
  "servicios",
  "marketing",
  "personal",
  "otro",
]);

/**
 * Trazabilidad del COGS: cuántas líneas del pedido aportaron costo, cuántas no
 * y cuánta venta queda sin respaldo de costo. Sin esto, un `amount_cents` bajo
 * es indistinguible de un pedido con productos sin costear (014 AC2).
 */
export type FinanceExpenseMetadata = {
  itemsWithCost: number;
  itemsWithoutCost: number;
  excludedSalesCents: number;
};

/**
 * Libro de egresos (014). Igual que en ingresos, las filas de origen `order_*`
 * son derivadas del pedido y no editables.
 */
export const financeExpense = pgTable(
  "finance_expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    origin: financeExpenseOrigin("origin").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: varchar("description", { length: 200 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    orderId: uuid("order_id").references(() => order.id, {
      onDelete: "restrict",
    }),
    category: financeExpenseCategory("category"),
    metadata: jsonb("metadata").$type<FinanceExpenseMetadata>(),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Idempotencia del webhook (AC4): por pedido, un COGS y un envío como
    // máximo. El origen entra en la clave porque son dos egresos distintos del
    // mismo pedido.
    uniqueIndex("finance_expense_order_origin_unique")
      .on(t.orderId, t.origin)
      .where(sql`${t.origin} in ('order_cogs', 'order_shipping')`),
    check(
      "finance_expense_amount_cents_non_negative",
      sql`${t.amountCents} >= 0`,
    ),
    check(
      "finance_expense_origin_coherent",
      sql`(${t.origin} in ('order_cogs', 'order_shipping') and ${t.orderId} is not null and ${t.category} is null)
          or (${t.origin} = 'manual' and ${t.orderId} is null and ${t.category} is not null)`,
    ),
  ],
);

export type FinanceExpense = InferSelectModel<typeof financeExpense>;
export type NewFinanceExpense = InferInsertModel<typeof financeExpense>;
export type FinanceExpenseOrigin = FinanceExpense["origin"];
