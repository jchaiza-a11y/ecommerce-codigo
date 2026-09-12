import { isAxiosError } from "axios";

import { api } from "@/lib/axios";

const RESOURCE = "/api/profile";

export const CONFIRM_PASSWORD_ERROR =
  "No se pudo confirmar el cambio de contraseña";

export type PasswordChangedResponse = {
  mustChangePassword: boolean;
};

/** Confirma sobre la propia cuenta que la contraseña temporal ya se cambió. */
export async function confirmPasswordChanged(): Promise<PasswordChangedResponse> {
  const { data } = await api.post<PasswordChangedResponse>(
    `${RESOURCE}/password-changed`,
  );

  return data;
}

// Replicado en vez de importado desde otro módulo: cada dominio es autónomo
// (002 §7).

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
