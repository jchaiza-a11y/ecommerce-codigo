// Import de tipo: se borra en compilación, así el bundle de cliente nunca
// arrastra `db` ni Drizzle a través de este reexport.
import type { Category } from "@/server/db/schema/category";

export type { Category };
