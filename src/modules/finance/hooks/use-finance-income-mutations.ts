"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";
import { financeKeys } from "@/modules/finance/constants";
import type {
  CreateManualIncomeValues,
  UpdateManualIncomeInput,
} from "@/modules/finance/schemas/finance.schema";
import {
  createFinanceIncome,
  deleteFinanceIncome,
  updateFinanceIncome,
} from "@/modules/finance/services/finance.service";

/**
 * Mutaciones del libro de ingresos manuales (016 T11).
 *
 * Se invalida `financeKeys.all` y no solo la lista: un alta o un borrado mueven
 * también las cifras del Resumen, que es otra query del mismo módulo (AC1/AC4).
 */
export function useCreateFinanceIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateManualIncomeValues) => createFinanceIncome(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Ingreso registrado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el ingreso"));
    },
  });
}

export function useUpdateFinanceIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateManualIncomeInput;
    }) => updateFinanceIncome(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Ingreso actualizado");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "No se pudo actualizar el ingreso"),
      );
    },
  });
}

export function useDeleteFinanceIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteFinanceIncome(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Ingreso eliminado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el ingreso"));
    },
  });
}
