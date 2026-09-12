// Import de tipo: se borra en compilación, así el bundle de cliente nunca
// arrastra `db` ni Drizzle a través de este reexport.
import type { Product } from "@/server/db/schema/product";
import type { ProductListItem } from "@/server/repositories/product.repository";

export type { Product, ProductListItem };
