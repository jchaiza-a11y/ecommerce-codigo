import type { AuditLogFiltersInput } from "@/modules/audit-logs/schemas/audit-log.schema";
import type { AuditSeverity } from "@/modules/audit-logs/types/audit-log.types";

export const auditLogKeys = {
  all: ["audit-logs"] as const,
  lists: () => [...auditLogKeys.all, "list"] as const,
  list: (filters: AuditLogFiltersInput) =>
    [...auditLogKeys.lists(), filters] as const,
};

export const AUDIT_ENTITY_OPTIONS = [
  { label: "Usuario", value: "user" },
  { label: "Producto", value: "product" },
  { label: "Categoría", value: "category" },
] as const;

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: "Informativo",
  warning: "Atención",
  error: "Error",
};

/** Traducción a lenguaje llano de las acciones que registra esta fase. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.auto_provisioned": "Alta automática desde Clerk",
  "user.synced": "Datos sincronizados desde Clerk",
  "user.deactivated_by_clerk": "Cuenta eliminada en Clerk",
  "user.created": "Usuario creado desde el panel",
  "user.updated": "Datos de usuario actualizados",
  "user.activation_changed": "Estado de la cuenta cambiado",
  "user.roles_assigned": "Roles reasignados",
};

export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}
