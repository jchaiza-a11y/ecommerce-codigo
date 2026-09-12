import { asc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import type { PgStatement } from "@/server/db/batch";
import { role } from "@/server/db/schema/role";
import { userRole } from "@/server/db/schema/user-role";

import type { UserRoleSummary } from "./user.repository";

export async function findByUserId(
  userId: string,
): Promise<UserRoleSummary[]> {
  return db
    .select({ slug: role.slug, name: role.name })
    .from(userRole)
    .innerJoin(role, eq(role.id, userRole.roleId))
    .where(eq(userRole.userId, userId))
    .orderBy(asc(role.slug));
}

/**
 * Sentencias para reemplazar el set completo de roles de un usuario. Se
 * devuelven sin ejecutar para que el llamador las meta en el mismo `batch` que
 * su `audit_logs`: si el log falla, la asignación revierte (003 §8.5).
 */
export function buildReplaceForUser(
  userId: string,
  roleIds: readonly string[],
  assignedBy: string | null,
): PgStatement[] {
  const statements: PgStatement[] = [
    db.delete(userRole).where(eq(userRole.userId, userId)),
  ];

  if (roleIds.length > 0) {
    statements.push(
      db.insert(userRole).values(
        roleIds.map((roleId) => ({
          userId,
          roleId,
          assignedBy,
        })),
      ),
    );
  }

  return statements;
}

/** Alta de roles iniciales: el usuario acaba de crearse y no tiene ninguno. */
export function buildInsertForUser(
  userId: string,
  roleIds: readonly string[],
  assignedBy: string | null,
): PgStatement[] {
  if (roleIds.length === 0) {
    return [];
  }

  return [
    db
      .insert(userRole)
      .values(
        roleIds.map((roleId) => ({ userId, roleId, assignedBy })),
      )
      .onConflictDoNothing(),
  ];
}
