import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import type { PgStatement } from "@/server/db/batch";
import { financeExpense } from "@/server/db/schema/finance-expense";
import type { FinanceExpenseMetadata } from "@/server/db/schema/finance-expense";
import { financeIncome } from "@/server/db/schema/finance-income";
import {
  financeSettings,
  FINANCE_SETTINGS_ID,
} from "@/server/db/schema/finance-settings";

// Reexpuesto para que el Route Handler pueda identificar la entidad en la
// bitácora sin importar el schema Drizzle: sigue hablando solo con el
// repositorio (SETUP.md §4 regla 3).
export { FINANCE_SETTINGS_ID };

/** Valores de configuración, sin el `id` ni el `updated_at` del singleton. */
export type FinanceSettingsValues = {
  shippingCostCents: number;
};

/**
 * La migración 0006 crea la fila singleton, así que en la práctica siempre
 * existe. El default cubre una base migrada a mano: dejar el fulfillment sin
 * tarifa de envío es peor que asumir cero.
 */
const DEFAULT_SETTINGS: FinanceSettingsValues = { shippingCostCents: 0 };

export async function getSettings(): Promise<FinanceSettingsValues> {
  const [found] = await db
    .select({ shippingCostCents: financeSettings.shippingCostCents })
    .from(financeSettings)
    .where(eq(financeSettings.id, FINANCE_SETTINGS_ID))
    .limit(1);

  return found ?? DEFAULT_SETTINGS;
}

/**
 * Sin ejecutar: viaja en el mismo `batch` que su `audit_logs` (CLAUDE.md §4.9).
 *
 * Es un upsert y no un `update` para que la configuración quede escrita aunque
 * la fila singleton no exista; con un `update` el PATCH afectaría cero filas y
 * respondería 200 sin haber guardado nada.
 */
export function buildUpdateSettings(shippingCostCents: number): PgStatement {
  return db
    .insert(financeSettings)
    .values({ id: FINANCE_SETTINGS_ID, shippingCostCents })
    .onConflictDoUpdate({
      target: financeSettings.id,
      set: { shippingCostCents },
    });
}

/** Lo mínimo del pedido que el ledger necesita: no arrastra líneas ni cliente. */
export type LedgerOrder = {
  id: string;
  totalCents: number;
};

/**
 * Línea del pedido emparejada con el costo vigente de su producto. `costCents`
 * en `null` es "producto sin costear", distinto de un costo de cero.
 */
export type LedgerLine = {
  quantity: number;
  unitPriceCents: number;
  costCents: number | null;
};

export type CogsSummary = FinanceExpenseMetadata & {
  amountCents: number;
};

/**
 * COGS agregado del pedido (014 §Notas): una sola fila con la suma, no una por
 * línea. Las líneas sin costo no aportan al monto —sumar cero inflaría el
 * margen en silencio— y quedan contadas en la metadata para que la vista de
 * margen pueda advertir que el dato está incompleto.
 */
export function summarizeCogs(lines: readonly LedgerLine[]): CogsSummary {
  return lines.reduce<CogsSummary>(
    (summary, line) =>
      line.costCents === null
        ? {
            ...summary,
            itemsWithoutCost: summary.itemsWithoutCost + 1,
            excludedSalesCents:
              summary.excludedSalesCents + line.unitPriceCents * line.quantity,
          }
        : {
            ...summary,
            amountCents: summary.amountCents + line.costCents * line.quantity,
            itemsWithCost: summary.itemsWithCost + 1,
          },
    {
      amountCents: 0,
      itemsWithCost: 0,
      itemsWithoutCost: 0,
      excludedSalesCents: 0,
    },
  );
}

/**
 * Los tres `build*` de ledger llevan `onConflictDoNothing()` sin destino: el
 * arbitraje lo hacen los índices únicos parciales de cada tabla. Es la defensa
 * contra dos entregas simultáneas del mismo evento de Stripe, que el
 * pre-chequeo de estado del fulfillment no cubre (AC4).
 */
export function buildIncomeInsert(order: LedgerOrder): PgStatement {
  return db
    .insert(financeIncome)
    .values({
      origin: "order",
      amountCents: order.totalCents,
      orderId: order.id,
    })
    .onConflictDoNothing();
}

export function buildCogsInsert(
  order: LedgerOrder,
  lines: readonly LedgerLine[],
): PgStatement {
  const { amountCents, ...metadata } = summarizeCogs(lines);

  return db
    .insert(financeExpense)
    .values({
      origin: "order_cogs",
      amountCents,
      orderId: order.id,
      metadata,
    })
    .onConflictDoNothing();
}

export function buildShippingInsert(
  order: LedgerOrder,
  shippingCostCents: number,
): PgStatement {
  return db
    .insert(financeExpense)
    .values({
      origin: "order_shipping",
      amountCents: shippingCostCents,
      orderId: order.id,
    })
    .onConflictDoNothing();
}
