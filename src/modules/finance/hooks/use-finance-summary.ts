"use client";

import { useQuery } from "@tanstack/react-query";

import { financeKeys } from "@/modules/finance/constants";
import { getFinanceSummary } from "@/modules/finance/services/finance.service";

export function useFinanceSummary() {
  return useQuery({
    queryKey: financeKeys.summary(),
    queryFn: getFinanceSummary,
  });
}
