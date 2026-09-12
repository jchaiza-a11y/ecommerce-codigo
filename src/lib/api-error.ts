import { isAxiosError } from "axios";

/**
 * Traduce el cuerpo de error uniforme de la API (`{ error: string }`) a un
 * mensaje presentable.
 *
 * Vive en `lib/` y no en un módulo porque el contrato de error es transversal a
 * todos los Route Handlers, no de un dominio. Sin `server-only`: lo consumen
 * hooks de cliente.
 *
 * Los services previos a 008 conservan su copia local; migrarlos es deuda
 * aparte y no de este spec.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(error)) {
    const message = error.response?.data?.error;

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}
