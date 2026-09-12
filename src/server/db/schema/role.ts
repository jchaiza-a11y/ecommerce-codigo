import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const role = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 40 }).notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    description: text("description"),
    // Los roles de sistema no se borran ni se renombran desde la UI
    // (SETUP.md §5.1). En esta fase los seis roles son de sistema.
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("roles_slug_unique").on(t.slug)],
);

export type Role = InferSelectModel<typeof role>;
export type NewRole = InferInsertModel<typeof role>;
