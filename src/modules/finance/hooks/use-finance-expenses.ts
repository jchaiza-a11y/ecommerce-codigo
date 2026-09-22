"use client";

import { useQuery } from "@tanstack/react-query";

import { financeKeys } from "@/modules/finance/constants";
import type { FinanceListFiltersInput } from "@/modules/finance/schemas/finance.schema";
import { getFinanceExpenses } from "@/modules/finance/services/finance.service";

export function useFinanceExpenses(filters: FinanceListFiltersInput) {
  return useQuery({
    queryKey: financeKeys.expenses(filters),
    queryFn: () => getFinanceExpenses(filters),
  });
}
