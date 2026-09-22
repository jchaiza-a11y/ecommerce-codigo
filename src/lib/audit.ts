import "server-only";

import { runBatch, type PgStatement } from "@/server/db/batch";
import type { AuditChanges, NewAuditLog } from "@/server/db/schema/audit-log";
import * as auditLogRepository from "@/server/repositories/audit-log.repository";

/** Acciones registradas por esta fase. El prefijo agrupa por dominio. */
export const AUDIT_ACTIONS = {
  USER_AUTO_PROVISIONED: "user.auto_provisioned",
  USER_SYNCED: "user.synced",
  USER_DEACTIVATED_BY_CLERK: "user.deactivated_by_clerk",
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_ACTIVATION_CHANGED: "user.activation_changed",
  USER_PASSWORD_CHANGE_CONFIRMED: "user.password_change_confirmed",
  ROLES_ASSIGNED: "user.roles_assigned",
  ORDER_PAID: "order.paid",
  ORDER_PAYMENT_FAILED: "order.payment_failed",
  PRODUCT_STOCK_ADJUSTED: "product.stock_adjusted",
  PRODUCT_LOW_STOCK_THRESHOLD_UPDATED: "product.low_stock_threshold_updated",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditLogPayload = {
  /** `null` = acción del sistema (webhook, cron), no de una persona. */
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  changes?: AuditChanges | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: NewAuditLog["severity"];
};

// SETUP.md §5.2 regla 3: ni contraseñas, ni tokens, ni claves, ni datos de
// tarjeta en `changes` o `metadata`. El enmascarado es por nombre de campo y se
// aplica siempre, no a criterio del llamador.
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|api[-_]?key|authorization|credential|cvv|card[-_]?number)/i;
const REDACTED = "[redactado]";
const MAX_MASK_DEPTH = 6;

function maskValue(value: unknown, depth: number): unknown {
  if (depth >= MAX_MASK_DEPTH) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    return maskRecord(value as Record<string, unknown>, depth + 1);
  }

  return value;
}

function maskRecord(
  source: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    masked[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : maskValue(value, depth);
  }

  return masked;
}

function maskChanges(changes: AuditChanges | null | undefined): AuditChanges | null {
  if (!changes) {
    return null;
  }

  return {
    ...(changes.before ? { before: maskRecord(changes.before) } : {}),
    ...(changes.after ? { after: maskRecord(changes.after) } : {}),
  };
}

function toRow(payload: AuditLogPayload): NewAuditLog {
  return {
    actorId: payload.actorId,
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId ?? null,
    changes: maskChanges(payload.changes),
    metadata: payload.metadata ? maskRecord(payload.metadata) : null,
    ipAddress: payload.ipAddress ?? null,
    userAgent: payload.userAgent ?? null,
    severity: payload.severity ?? "info",
  };
}

/**
 * Devuelve la sentencia SIN ejecutar para que el llamador la incluya en el
 * mismo `db.batch()` que la mutación auditada. Es la forma de cumplir
 * CLAUDE.md §4.9 con el driver `neon-http`, que no soporta transacciones
 * interactivas (003 §8.5).
 */
export function buildAuditLogInsert(payload: AuditLogPayload): PgStatement {
  return auditLogRepository.buildInsert(toRow(payload));
}

/**
 * Ejecución suelta, solo para eventos que no acompañan a ninguna mutación (el
 * log ES la operación). Si hay una mutación que auditar, se usa
 * `buildAuditLogInsert` dentro del batch.
 */
export async function recordAuditLog(payload: AuditLogPayload): Promise<void> {
  await runBatch([buildAuditLogInsert(payload)]);
}

/** Contexto de red de la petición, para no repetir el parseo en cada handler. */
export function getRequestAuditContext(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    null;

  return {
    // La columna es `inet`: un valor que Postgres no sepa parsear tumbaría la
    // mutación entera. Ante la duda se guarda `null`.
    ipAddress: candidate && isIpAddress(candidate) ? candidate : null,
    userAgent: request.headers.get("user-agent"),
  };
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

function isIpAddress(value: string): boolean {
  if (IPV4.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }

  return value.includes(":") && IPV6.test(value);
}
