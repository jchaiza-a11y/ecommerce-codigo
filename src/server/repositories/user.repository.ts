import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import type { PgStatement } from "@/server/db/batch";
import { permission } from "@/server/db/schema/permission";
import { role } from "@/server/db/schema/role";
import { rolePermission } from "@/server/db/schema/role-permission";
import { user } from "@/server/db/schema/user";
import type { NewUser, User } from "@/server/db/schema/user";
import { userRole } from "@/server/db/schema/user-role";

export type UpdateUserData = Partial<
  Omit<NewUser, "id" | "clerkId" | "createdAt" | "updatedAt">
>;

/** Rol tal y como se muestra en el panel: nunca el id crudo. */
export type UserRoleSummary = { slug: string; name: string };

/** Fila de listado: los roles llegan del join, sin una consulta por fila. */
export type UserListItem = User & { roles: UserRoleSummary[] };

/**
 * Set de acceso efectivo de un usuario: la autoridad de autorización
 * (003 §8.1). `permissionCodes` viene deduplicado entre roles solapados.
 */
export type UserAccess = {
  user: User;
  roles: UserRoleSummary[];
  permissionCodes: string[];
};

export { isForeignKeyViolation, isUniqueViolation } from "@/server/db/pg-errors";

function groupRolesByUser(
  rows: ReadonlyArray<{
    user: User;
    roleSlug: string | null;
    roleName: string | null;
  }>,
): UserListItem[] {
  const byId = new Map<string, UserListItem>();

  for (const row of rows) {
    const existing = byId.get(row.user.id);
    const target = existing ?? { ...row.user, roles: [] };

    if (!existing) {
      byId.set(row.user.id, target);
    }

    if (row.roleSlug && row.roleName) {
      target.roles.push({ slug: row.roleSlug, name: row.roleName });
    }
  }

  return [...byId.values()];
}

/**
 * Un solo `LEFT JOIN` agregado en memoria: el listado no puede resolver los
 * roles con una consulta por fila (003 §11, riesgo de N+1).
 */
export async function findAllWithRoles(): Promise<UserListItem[]> {
  const rows = await db
    .select({ user, roleSlug: role.slug, roleName: role.name })
    .from(user)
    .leftJoin(userRole, eq(userRole.userId, user.id))
    .leftJoin(role, eq(role.id, userRole.roleId))
    .orderBy(desc(user.createdAt), asc(role.slug));

  return groupRolesByUser(rows);
}

export async function findByIdWithRoles(
  id: string,
): Promise<UserListItem | undefined> {
  const rows = await db
    .select({ user, roleSlug: role.slug, roleName: role.name })
    .from(user)
    .leftJoin(userRole, eq(userRole.userId, user.id))
    .leftJoin(role, eq(role.id, userRole.roleId))
    .where(eq(user.id, id))
    .orderBy(asc(role.slug));

  return groupRolesByUser(rows)[0];
}

export async function findById(id: string): Promise<User | undefined> {
  const [found] = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  return found;
}

export async function findByClerkId(
  clerkId: string,
): Promise<User | undefined> {
  const [found] = await db
    .select()
    .from(user)
    .where(eq(user.clerkId, clerkId))
    .limit(1);

  return found;
}

export async function findByEmail(email: string): Promise<User | undefined> {
  const [found] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return found;
}

/**
 * Resuelve el acceso efectivo recorriendo
 * `users ⋈ user_roles ⋈ roles ⋈ role_permissions ⋈ permissions`. Los joins son
 * `LEFT` a propósito: un usuario sin roles, o con un rol sin permisos, sigue
 * existiendo y debe devolverse con la lista vacía, no como "no encontrado".
 */
export async function findRolesAndPermissionsByClerkId(
  clerkId: string,
): Promise<UserAccess | undefined> {
  const rows = await db
    .select({
      user,
      roleSlug: role.slug,
      roleName: role.name,
      permissionCode: permission.code,
    })
    .from(user)
    .leftJoin(userRole, eq(userRole.userId, user.id))
    .leftJoin(role, eq(role.id, userRole.roleId))
    .leftJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .leftJoin(permission, eq(permission.id, rolePermission.permissionId))
    .where(eq(user.clerkId, clerkId));

  const first = rows[0];

  if (!first) {
    return undefined;
  }

  const roles = new Map<string, UserRoleSummary>();
  const permissionCodes = new Set<string>();

  for (const row of rows) {
    if (row.roleSlug && row.roleName) {
      roles.set(row.roleSlug, { slug: row.roleSlug, name: row.roleName });
    }

    if (row.permissionCode) {
      permissionCodes.add(row.permissionCode);
    }
  }

  return {
    user: first.user,
    roles: [...roles.values()],
    permissionCodes: [...permissionCodes],
  };
}

export async function create(data: NewUser): Promise<User> {
  const [created] = await db.insert(user).values(data).returning();

  return created;
}

/**
 * Sentencia de upsert por `clerk_id` para el webhook: se devuelve sin ejecutar
 * para que el llamador la meta en el mismo `batch` que su `audit_logs` (§8.5).
 * El `id` lo genera la app porque dentro de un batch no se puede alimentar una
 * sentencia con el `returning()` de otra.
 */
export function buildUpsertByClerkId(data: NewUser): PgStatement {
  return db
    .insert(user)
    .values(data)
    .onConflictDoUpdate({
      target: user.clerkId,
      set: {
        email: data.email,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        imageUrl: data.imageUrl ?? null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Enlaza el Customer de Stripe con el usuario **solo si todavía no tiene uno**
 * (010 §Notas): dos altas simultáneas —una tarjeta y una compra a la vez—
 * crearían dos Customers y el segundo pisaría al primero, dejando huérfanas las
 * tarjetas ya adjuntas al primero.
 *
 * Devuelve `undefined` cuando la carrera la ganó la otra petición; el llamador
 * relee la fila y se queda con el Customer ya persistido.
 */
export async function attachStripeCustomerId(
  userId: string,
  stripeCustomerId: string,
): Promise<User | undefined> {
  const [updated] = await db
    .update(user)
    .set({ stripeCustomerId })
    .where(and(eq(user.id, userId), isNull(user.stripeCustomerId)))
    .returning();

  return updated;
}

export function buildUpdate(id: string, data: UpdateUserData): PgStatement {
  return db.update(user).set(data).where(eq(user.id, id));
}

export async function update(
  id: string,
  data: UpdateUserData,
): Promise<User | undefined> {
  const [updated] = await db
    .update(user)
    .set(data)
    .where(eq(user.id, id))
    .returning();

  return updated;
}

export async function setActive(
  id: string,
  isActive: boolean,
): Promise<User | undefined> {
  return update(id, { isActive });
}

/**
 * Baja lógica desde el webhook `user.deleted`: la fila sobrevive porque
 * `audit_logs.actor_id` y las futuras referencias de pedidos la necesitan.
 */
export function buildDeactivateByClerkId(clerkId: string): PgStatement {
  return db
    .update(user)
    .set({ isActive: false })
    .where(eq(user.clerkId, clerkId));
}
