import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/server/db";
import type { PgStatement } from "@/server/db/batch";
import { auditLog } from "@/server/db/schema/audit-log";
import type { AuditLog, NewAuditLog } from "@/server/db/schema/audit-log";
import { user } from "@/server/db/schema/user";

/**
 * Repositorio append-only (SETUP.md §5.2): no expone `update` ni `remove` a
 * propósito. El único borrado admisible sería una purga por retención, que es
 * un job y no una petición de usuario, y queda fuera de este alcance.
 */

/** Fila de la bitácora con el actor ya resuelto: sin una consulta por fila. */
export type AuditLogListItem = AuditLog & {
  actorEmail: string | null;
  actorName: string | null;
};

export type AuditLogFilters = {
  entityType?: string;
  action?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  limit: number;
};

export async function findMany(
  filters: AuditLogFilters,
): Promise<AuditLogListItem[]> {
  const rows = await db
    .select({
      auditLog,
      actorEmail: user.email,
      actorFirstName: user.firstName,
      actorLastName: user.lastName,
    })
    .from(auditLog)
    // `LEFT`: `actor_id` es nulo en las acciones del sistema (webhooks, cron).
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(
      and(
        filters.entityType
          ? eq(auditLog.entityType, filters.entityType)
          : undefined,
        filters.action ? eq(auditLog.action, filters.action) : undefined,
        filters.actorId ? eq(auditLog.actorId, filters.actorId) : undefined,
        filters.from ? gte(auditLog.createdAt, filters.from) : undefined,
        filters.to ? lte(auditLog.createdAt, filters.to) : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(filters.limit);

  return rows.map((row) => {
    const name = [row.actorFirstName, row.actorLastName]
      .filter((part): part is string => Boolean(part))
      .join(" ");

    return {
      ...row.auditLog,
      actorEmail: row.actorEmail,
      actorName: name.length > 0 ? name : null,
    };
  });
}

/**
 * Sentencia de inserción sin ejecutar: el llamador la incluye en el mismo
 * `batch` que la mutación auditada, de modo que log y mutación revierten
 * juntos (003 §8.5, CLAUDE.md §4.9).
 */
export function buildInsert(values: NewAuditLog): PgStatement {
  return db.insert(auditLog).values(values);
}
