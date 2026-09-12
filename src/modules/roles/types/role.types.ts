// Import de tipo: se borra en compilación, así el bundle de cliente nunca
// arrastra `db` ni Drizzle a través de este reexport.
import type { Role } from "@/server/db/schema/role";
import type { RoleWithPermissions } from "@/server/repositories/role.repository";

export type { Role, RoleWithPermissions };
