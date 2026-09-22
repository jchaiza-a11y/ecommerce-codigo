"use client";

import { useQuery } from "@tanstack/react-query";

import { financeKeys } from "@/modules/finance/constants";
import type { FinanceListFiltersInput } from "@/modules/finance/schemas/finance.schema";
import { getFinanceIncome } from "@/modules/finance/services/finance.service";

export function useFinanceIncome(filters: FinanceListFiltersInput) {
  return useQuery({
    queryKey: financeKeys.income(filters),
    queryFn: () => getFinanceIncome(filters),
  });
}
