import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  smallint,
  timestamp,
} from "drizzle-orm/pg-core";

/** Única fila permitida por el check de singleton. */
export const FINANCE_SETTINGS_ID = 1;

/**
 * Parámetros globales de Finanzas (014). Tabla singleton: el `check id = 1`
 * impide que existan dos configuraciones y hace innecesario decidir "cuál es la
 * vigente" en cada lectura.
 *
 * La tarifa de envío es una sola para toda la tienda: el envío real por pedido
 * queda fuera de v1 (§Alcance).
 */
export const financeSettings = pgTable(
  "finance_settings",
  {
    id: smallint("id").primaryKey(),
    shippingCostCents: integer("shipping_cost_cents").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("finance_settings_singleton", sql`${t.id} = 1`),
    check(
      "finance_settings_shipping_cost_cents_non_negative",
      sql`${t.shippingCostCents} >= 0`,
    ),
  ],
);

export type FinanceSettings = InferSelectModel<typeof financeSettings>;
export type NewFinanceSettings = InferInsertModel<typeof financeSettings>;
