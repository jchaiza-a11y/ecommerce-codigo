import { isAxiosError } from "axios";

import { api } from "@/lib/axios";
import type { AuditLogFiltersInput } from "@/modules/audit-logs/schemas/audit-log.schema";
import type { AuditLogListItem } from "@/modules/audit-logs/types/audit-log.types";

const RESOURCE = "/api/admin/audit-logs";

/** Los filtros vacíos no viajan: el endpoint los trata como "sin filtrar". */
function toQueryParams(
  filters: AuditLogFiltersInput,
): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    params[key] = value instanceof Date ? value.toISOString() : String(value);
  }

  return params;
}

export async function getAuditLogs(
  filters: AuditLogFiltersInput,
): Promise<AuditLogListItem[]> {
  const { data } = await api.get<AuditLogListItem[]>(RESOURCE, {
    params: toQueryParams(filters),
  });

  return data;
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
