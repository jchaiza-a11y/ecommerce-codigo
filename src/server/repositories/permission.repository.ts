import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { permission } from "@/server/db/schema/permission";
import type { Permission } from "@/server/db/schema/permission";
import { rolePermission } from "@/server/db/schema/role-permission";

export async function findAll(): Promise<Permission[]> {
  return db
    .select()
    .from(permission)
    .orderBy(asc(permission.resource), asc(permission.action));
}

/** Permisos efectivos de un conjunto de roles, deduplicados por código. */
export async function findByRoleIds(
  roleIds: readonly string[],
): Promise<Permission[]> {
  if (roleIds.length === 0) {
    return [];
  }

  const rows = await db
    .selectDistinctOn([permission.id], { permission })
    .from(permission)
    .innerJoin(rolePermission, eq(rolePermission.permissionId, permission.id))
    .where(inArray(rolePermission.roleId, [...roleIds]))
    .orderBy(asc(permission.id));

  return rows.map((row) => row.permission);
}
