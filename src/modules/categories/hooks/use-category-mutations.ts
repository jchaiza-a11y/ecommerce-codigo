"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { categoryKeys } from "@/modules/categories/constants";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import {
  createCategory,
  deleteCategory,
  getApiErrorMessage,
  updateCategory,
} from "@/modules/categories/services/category.service";

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success("Categoría creada");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo crear la categoría"));
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success("Categoría actualizada");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "No se pudo actualizar la categoría"),
      );
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success("Categoría eliminada");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "No se pudo eliminar la categoría"),
      );
    },
  });
}
