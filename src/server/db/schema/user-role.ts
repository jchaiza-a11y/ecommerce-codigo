import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { role } from "./role";
import { user } from "./user";

/**
 * Pivote usuario ↔ rol. `roleId` es RESTRICT a propósito: borrar un rol con
 * usuarios asignados debe fallar, no dejarlos sin autorización en silencio.
 * `assignedBy` es SET NULL para que el borrado del actor no arrastre la
 * asignación de otro usuario.
 */
export const userRole = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ name: "user_roles_pk", columns: [t.userId, t.roleId] }),
  ],
);

export type UserRole = InferSelectModel<typeof userRole>;
export type NewUserRole = InferInsertModel<typeof userRole>;
