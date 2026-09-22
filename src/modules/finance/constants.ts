import type { FinanceListFiltersInput } from "@/modules/finance/schemas/finance.schema";
import type {
  FinanceExpenseCategory,
  FinanceExpenseOrigin,
  FinanceIncomeOrigin,
} from "@/modules/finance/types/finance.types";

/**
 * Constantes del dominio de Finanzas (015 T11). Sin imports de servidor: lo
 * consumen hooks y componentes de cliente.
 */

export const financeKeys = {
  all: ["finance"] as const,
  summary: () => [...financeKeys.all, "summary"] as const,
  income: (filters: FinanceListFiltersInput) =>
    [...financeKeys.all, "income", filters] as const,
  expenses: (filters: FinanceListFiltersInput) =>
    [...financeKeys.all, "expenses", filters] as const,
};

/**
 * Tamaño de la ventana del resumen, en días. Fuente única: la consumen tanto
 * `server/services/finance-summary.service.ts` para calcular el rango como los
 * textos de UI ("últimos 30 días"), así que no pueden desincronizarse.
 */
export const RANGE_DAYS = 30;

export const INCOME_ORIGIN_LABELS: Record<FinanceIncomeOrigin, string> = {
  order: "Pedido",
  manual: "Manual",
};

export const EXPENSE_ORIGIN_LABELS: Record<FinanceExpenseOrigin, string> = {
  order_cogs: "Costo de venta",
  order_shipping: "Envío",
  manual: "Manual",
};

export const EXPENSE_CATEGORY_LABELS: Record<FinanceExpenseCategory, string> = {
  alquiler: "Alquiler",
  servicios: "Servicios",
  marketing: "Marketing",
  personal: "Personal",
  otro: "Otro",
};

/** Opciones del filtro por columna de cada listado, en el orden del enum. */
export const INCOME_ORIGIN_OPTIONS = Object.entries(INCOME_ORIGIN_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const EXPENSE_ORIGIN_OPTIONS = Object.entries(EXPENSE_ORIGIN_LABELS).map(
  ([value, label]) => ({ value, label }),
);

// Mismo criterio que en los demás módulos: un `Intl.DateTimeFormat` por celda
// es caro, así que se instancia a nivel de módulo.
const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** La fecha viaja como ISO en el JSON de la API y como `Date` en el servidor. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

/**
 * Referencia corta del pedido asociado a un movimiento. No es un enlace: hoy
 * no existe ninguna página de detalle de pedido en el panel, y un enlace a una
 * ruta inexistente es peor que un identificador legible (016 la añadirá).
 */
export function formatOrderReference(orderId: string): string {
  return `#${orderId.slice(0, 8)}`;
}

const percentFormatter = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** `pct` llega como entero de 0 a 100. */
export function formatPercent(pct: number): string {
  return percentFormatter.format(pct / 100);
}
