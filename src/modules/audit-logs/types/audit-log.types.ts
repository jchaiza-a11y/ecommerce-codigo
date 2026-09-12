// Import de tipo: se borra en compilación, así el bundle de cliente nunca
// arrastra `db` ni Drizzle a través de este reexport.
import type { AuditChanges, AuditLog } from "@/server/db/schema/audit-log";
import type { AuditLogListItem } from "@/server/repositories/audit-log.repository";

export type { AuditChanges, AuditLog, AuditLogListItem };

export type AuditSeverity = AuditLog["severity"];
