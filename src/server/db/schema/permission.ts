import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Tabla semilla: los permisos nacen del código (`db:seed`), no se editan desde
 * el panel (SETUP.md §5.1). `code` es siempre `<recurso>.<acción>`.
 */
export const permission = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 60 }).notNull(),
    resource: varchar("resource", { length: 40 }).notNull(),
    action: varchar("action", { length: 40 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("permissions_code_unique").on(t.code),
    index("permissions_resource_idx").on(t.resource),
  ],
);

export type Permission = InferSelectModel<typeof permission>;
export type NewPermission = InferInsertModel<typeof permission>;
