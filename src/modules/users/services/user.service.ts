import { isAxiosError } from "axios";

import { api } from "@/lib/axios";
import type {
  AssignRolesInput,
  CreateUserInput,
  UpdateUserInput,
} from "@/modules/users/schemas/user.schema";
import type {
  CreateUserResponse,
  UserDetail,
  UserListItem,
} from "@/modules/users/types/user.types";

const RESOURCE = "/api/admin/users";

export async function getUsers(): Promise<UserListItem[]> {
  const { data } = await api.get<UserListItem[]>(RESOURCE);

  return data;
}

export async function createUser(
  input: CreateUserInput,
): Promise<CreateUserResponse> {
  const { data } = await api.post<CreateUserResponse>(RESOURCE, input);

  return data;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<UserDetail> {
  const { data } = await api.patch<UserDetail>(`${RESOURCE}/${id}`, input);

  return data;
}

export async function assignRoles(
  id: string,
  input: AssignRolesInput,
): Promise<UserDetail> {
  const { data } = await api.put<UserDetail>(`${RESOURCE}/${id}/roles`, input);

  return data;
}

// Replicados desde `product.service.ts` en vez de importados: cada dominio es
// autónomo y no depende del módulo de productos (002 §7).

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

export function isForbiddenError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403;
}
