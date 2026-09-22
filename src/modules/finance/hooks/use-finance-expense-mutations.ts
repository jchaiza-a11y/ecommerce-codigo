"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";
import { financeKeys } from "@/modules/finance/constants";
import type {
  CreateManualExpenseValues,
  UpdateManualExpenseInput,
} from "@/modules/finance/schemas/finance.schema";
import {
  createFinanceExpense,
  deleteFinanceExpense,
  updateFinanceExpense,
} from "@/modules/finance/services/finance.service";

/**
 * Mutaciones del libro de egresos manuales (016 T11). Misma invalidación que en
 * ingresos: el Resumen es otra query del mismo módulo y también se mueve.
 */
export function useCreateFinanceExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateManualExpenseValues) =>
      createFinanceExpense(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Egreso registrado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el egreso"));
    },
  });
}

export function useUpdateFinanceExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateManualExpenseInput;
    }) => updateFinanceExpense(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Egreso actualizado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el egreso"));
    },
  });
}

export function useDeleteFinanceExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteFinanceExpense(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Egreso eliminado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el egreso"));
    },
  });
}
