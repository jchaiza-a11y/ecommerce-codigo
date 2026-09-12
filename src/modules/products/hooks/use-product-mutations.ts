"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { productKeys } from "@/modules/products/constants";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/modules/products/schemas/product.schema";
import {
  createProduct,
  deleteProduct,
  getApiErrorMessage,
  updateProduct,
} from "@/modules/products/services/product.service";

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Producto creado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo crear el producto"));
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      updateProduct(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Producto actualizado");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "No se pudo actualizar el producto"),
      );
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Producto eliminado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el producto"));
    },
  });
}
