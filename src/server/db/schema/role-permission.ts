import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

import { permission } from "./permission";
import { role } from "./role";

/**
 * Pivote rol ↔ permiso. Ambas FKs son CASCADE: la fila del pivote no tiene
 * sentido sin sus dos extremos y el seed la recompone entera.
 */
export const rolePermission = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({
      name: "role_permissions_pk",
      columns: [t.roleId, t.permissionId],
    }),
  ],
);

export type RolePermission = InferSelectModel<typeof rolePermission>;
export type NewRolePermission = InferInsertModel<typeof rolePermission>;
