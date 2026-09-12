import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";
import type { PublicProductRow } from "@/server/repositories/product.repository";

const NEW_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Único punto que construye la respuesta pública de un producto: solo valida
 * que sea una URL http(s) bien formada. No filtra por host — eso ocultaba
 * fotos reales subidas desde el admin con un proveedor distinto a Unsplash.
 * Qué hosts optimiza `next/image` es decisión del componente, vía
 * `isOptimizableImageUrl` (§8.5).
 */
function toSafeImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  try {
    const { protocol } = new URL(imageUrl);
    return protocol === "http:" || protocol === "https:" ? imageUrl : null;
  } catch {
    return null;
  }
}

/**
 * Guard único del descuento (004 §10): sin él, un `compare_at_price_cents`
 * menor o igual al precio pintaría una oferta que no existe. Se calcula aquí y
 * no en cada tarjeta para que solo haya una definición.
 */
function toDiscountPercent(
  priceCents: number,
  compareAtPriceCents: number | null,
): number | null {
  if (compareAtPriceCents === null || compareAtPriceCents <= priceCents) {
    return null;
  }

  return Math.floor(
    ((compareAtPriceCents - priceCents) / compareAtPriceCents) * 100,
  );
}

/**
 * Único punto que construye la respuesta pública de un producto. Devolver la
 * fila cruda de Drizzle expondría `sku` y `stock` y rompería AC2.
 */
export function toStorefrontProduct(row: PublicProductRow): StorefrontProduct {
  const discountPercent = toDiscountPercent(
    row.priceCents,
    row.compareAtPriceCents,
  );

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    description: row.description,
    priceCents: row.priceCents,
    compareAtPriceCents: discountPercent === null ? null : row.compareAtPriceCents,
    discountPercent,
    imageUrl: toSafeImageUrl(row.imageUrl),
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
    // El inventario exacto no se publica: solo si hay o no unidades.
    inStock: row.stock > 0,
    isNew: Date.now() - row.createdAt.getTime() < NEW_PRODUCT_WINDOW_MS,
  };
}
