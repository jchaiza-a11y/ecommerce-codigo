// Imports de tipo: se borran en compilación, así el bundle de cliente nunca
// arrastra `db` ni Drizzle a través de estos reexports.
import type { FinanceExpenseOrigin } from "@/server/db/schema/finance-expense";
import type { FinanceIncomeOrigin } from "@/server/db/schema/finance-income";
import type {
  FinanceExpenseCategory,
  FinanceExpenseListItem,
  FinanceIncomeCategory,
  FinanceIncomeListItem,
} from "@/server/repositories/finance.repository";

/**
 * Las categorías solo las llevan las filas manuales; las de pedido se clasifican
 * por su origen (014 §Datos).
 */
export type {
  FinanceExpenseCategory,
  FinanceExpenseListItem,
  FinanceExpenseOrigin,
  FinanceIncomeCategory,
  FinanceIncomeListItem,
  FinanceIncomeOrigin,
};

/**
 * Payload de `GET /api/admin/finance/summary` (015 §API).
 *
 * DTO de negocio agregado sobre `finance_income`/`finance_expense`, no la fila
 * de ninguna tabla, así que se declara a mano. Todos los importes son enteros
 * en centavos.
 */

export type FinanceExpenseBreakdown = {
  cogs: number;
  shipping: number;
  /** Incluye además los egresos manuales, que no tienen casilla propia. */
  total: number;
};

/**
 * Cobertura de costeo del rango (AC3): qué parte de la venta tiene un costo
 * detrás. Con 0 ingresos la cobertura es del 100 % — no hay venta descubierta
 * que advertir — y nunca se divide por cero (AC4).
 */
export type FinanceCostCoverage = {
  coveredSalesCents: number;
  excludedSalesCents: number;
  /** Entero de 0 a 100. */
  coveragePct: number;
};

/** Un punto de las dos series diarias; siempre hay uno por día del rango (AC5). */
export type FinanceDailyPoint = {
  /** Día UTC en formato `YYYY-MM-DD`. */
  date: string;
  incomeCents: number;
  expenseCents: number;
};

export type FinanceSummary = {
  /** Inicio del rango, ISO 8601. */
  rangeStart: string;
  /** Fin del rango, ISO 8601. */
  rangeEnd: string;
  incomeCents: number;
  expenseCents: FinanceExpenseBreakdown;
  /** IGV incluido en los ingresos. Informativo: no entra en `netProfitCents`. */
  igvCents: number;
  /** Ingresos − egresos (AC2). */
  netProfitCents: number;
  costCoverage: FinanceCostCoverage;
  daily: FinanceDailyPoint[];
};
