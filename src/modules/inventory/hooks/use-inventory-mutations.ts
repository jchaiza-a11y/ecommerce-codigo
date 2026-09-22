"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";
import { inventoryKeys } from "@/modules/inventory/constants";
import type {
  AdjustStockInput,
  UpdateThresholdInput,
} from "@/modules/inventory/schemas/inventory.schema";
import {
  adjustStock,
  updateLowStockThreshold,
} from "@/modules/inventory/services/inventory.service";
import { productKeys } from "@/modules/products/constants";

/**
 * Doble invalidación (013 §Notas). `/admin/products` pinta la misma columna de
 * stock desde otra clave de caché: invalidar solo `inventoryKeys` dejaría esa
 * tabla mintiendo hasta su siguiente refetch.
 */
function invalidateStockViews(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
    queryClient.invalidateQueries({ queryKey: productKeys.all }),
  ]);
}

type AdjustStockVariables = {
  productId: string;
  input: AdjustStockInput;
};

/** Reposición: `quantity` suma unidades, nunca reemplaza el total (AC4). */
export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: AdjustStockVariables) =>
      adjustStock(productId, input),
    onSuccess: async (item) => {
      await invalidateStockViews(queryClient);
      toast.success(`${item.name}: stock actualizado a ${item.stock}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo reponer el stock"));
    },
  });
}

type UpdateThresholdVariables = {
  productId: string;
  input: UpdateThresholdInput;
};

export function useUpdateLowStockThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: UpdateThresholdVariables) =>
      updateLowStockThreshold(productId, input),
    onSuccess: async (item) => {
      await invalidateStockViews(queryClient);
      toast.success(
        `${item.name}: umbral actualizado a ${item.lowStockThreshold}`,
      );
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el umbral"));
    },
  });
}
