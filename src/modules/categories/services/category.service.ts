import { isAxiosError } from "axios";

import { api } from "@/lib/axios";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import type { Category } from "@/modules/categories/types/category.types";

const RESOURCE = "/api/categories";

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>(RESOURCE);

  return data;
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const { data } = await api.post<Category>(RESOURCE, input);

  return data;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const { data } = await api.patch<Category>(`${RESOURCE}/${id}`, input);

  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`${RESOURCE}/${id}`);
}

/** Traduce el cuerpo de error uniforme de la API a un mensaje presentable. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    const message = error.response?.data?.error;

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export function isConflictError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409;
}
