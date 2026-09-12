import { desc, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  inet,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./user";

export const auditSeverity = pgEnum("audit_severity", [
  "info",
  "warning",
  "error",
]);

/** `{ before, after }` con solo los campos que cambiaron (SETUP.md §5.2). */
export type AuditChanges = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

/**
 * Traza append-only: sin `UPDATE` ni `DELETE` desde la aplicación. El actor es
 * nullable porque el sistema (webhooks, cron) también escribe, y es SET NULL
 * para que borrar un usuario no borre su rastro.
 */
export const auditLog = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    changes: jsonb("changes").$type<AuditChanges>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    severity: auditSeverity("severity").notNull().default("info"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_created_idx").on(t.actorId, desc(t.createdAt)),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_idx").on(desc(t.createdAt)),
  ],
);

export type AuditLog = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;
