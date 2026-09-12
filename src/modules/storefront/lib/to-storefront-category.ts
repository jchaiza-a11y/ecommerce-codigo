import type { StorefrontCategory } from "@/modules/storefront/schemas/catalog.schema";
import type { CategoryWithProductCount } from "@/server/repositories/category.repository";

/**
 * Contraparte de `toStorefrontProduct` para la taxonomía: la fila de
 * `categories` lleva `isActive`, `sortOrder` y fechas que la tienda no publica.
 */
export function toStorefrontCategory(
  row: CategoryWithProductCount,
): StorefrontCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    productCount: row.productCount,
  };
}
