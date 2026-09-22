import { api } from "@/lib/axios";
import type { FinanceListFiltersInput } from "@/modules/finance/schemas/finance.schema";
import type {
  FinanceExpenseListItem,
  FinanceIncomeListItem,
  FinanceSummary,
} from "@/modules/finance/types/finance.types";

const RESOURCE = "/api/admin/finance";

/**
 * Llamadas tipadas del módulo de Finanzas (015 T10). Sin copia local de
 * `getApiErrorMessage`: se consume el helper transversal de `@/lib/api-error`
 * desde la capa de UI.
 */

/** Los filtros vacíos no viajan: el endpoint los trata como "sin filtrar". */
function toQueryParams(
  filters: FinanceListFiltersInput,
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    params[key] = value instanceof Date ? value.toISOString() : String(value);
  }

  return params;
}

/** La ventana de 30 días la fija el servidor, así que no recibe argumentos. */
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const { data } = await api.get<FinanceSummary>(`${RESOURCE}/summary`);

  return data;
}

export async function getFinanceIncome(
  filters: FinanceListFiltersInput,
): Promise<FinanceIncomeListItem[]> {
  const { data } = await api.get<FinanceIncomeListItem[]>(
    `${RESOURCE}/income`,
    { params: toQueryParams(filters) },
  );

  return data;
}

export async function getFinanceExpenses(
  filters: FinanceListFiltersInput,
): Promise<FinanceExpenseListItem[]> {
  const { data } = await api.get<FinanceExpenseListItem[]>(
    `${RESOURCE}/expenses`,
    { params: toQueryParams(filters) },
  );

  return data;
}
