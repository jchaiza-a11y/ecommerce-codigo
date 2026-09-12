import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { permission } from "@/server/db/schema/permission";
import { role } from "@/server/db/schema/role";
import type { Role } from "@/server/db/schema/role";
import { rolePermission } from "@/server/db/schema/role-permission";
import { userRole } from "@/server/db/schema/user-role";

/** Catálogo de solo lectura: el rol viaja con sus códigos de permiso. */
export type RoleWithPermissions = Role & { permissionCodes: string[] };

export async function findAll(): Promise<Role[]> {
  return db.select().from(role).orderBy(asc(role.name));
}

export async function findBySlugs(slugs: readonly string[]): Promise<Role[]> {
  if (slugs.length === 0) {
    return [];
  }

  return db
    .select()
    .from(role)
    .where(inArray(role.slug, [...slugs]));
}

/** Un solo `LEFT JOIN` agregado en memoria, sin una consulta por rol. */
export async function findAllWithPermissions(): Promise<RoleWithPermissions[]> {
  const rows = await db
    .select({ role, permissionCode: permission.code })
    .from(role)
    .leftJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .leftJoin(permission, eq(permission.id, rolePermission.permissionId))
    .orderBy(asc(role.name), asc(permission.code));

  const byId = new Map<string, RoleWithPermissions>();

  for (const row of rows) {
    const existing = byId.get(row.role.id);
    const target = existing ?? { ...row.role, permissionCodes: [] };

    if (!existing) {
      byId.set(row.role.id, target);
    }

    if (row.permissionCode) {
      target.permissionCodes.push(row.permissionCode);
    }
  }

  return [...byId.values()];
}

/**
 * ¿Hay ya algún usuario con este rol? Sostiene el bootstrap del primer
 * `super_admin` (003 §8.6): en cuanto existe uno, la rama queda muerta.
 */
export async function existsUserWithRoleSlug(slug: string): Promise<boolean> {
  const [found] = await db
    .select({ userId: userRole.userId })
    .from(userRole)
    .innerJoin(role, eq(role.id, userRole.roleId))
    .where(eq(role.slug, slug))
    .limit(1);

  return found !== undefined;
}
