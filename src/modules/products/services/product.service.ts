import { isAxiosError } from "axios";

import { api } from "@/lib/axios";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/modules/products/schemas/product.schema";
import type {
  Product,
  ProductListItem,
} from "@/modules/products/types/product.types";

const RESOURCE = "/api/products";

export async function getProducts(): Promise<ProductListItem[]> {
  const { data } = await api.get<ProductListItem[]>(RESOURCE);

  return data;
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const { data } = await api.post<Product>(RESOURCE, input);

  return data;
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<Product> {
  const { data } = await api.patch<Product>(`${RESOURCE}/${id}`, input);

  return data;
}

export async function deleteProduct(id: string): Promise<void> {
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
