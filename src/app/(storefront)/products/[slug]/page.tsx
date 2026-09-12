import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/modules/storefront/components/product-detail";
import { SimilarProducts } from "@/modules/storefront/components/similar-products";
import { SIMILAR_PRODUCTS_LIMIT } from "@/modules/storefront/constants";
import { toStorefrontProduct } from "@/modules/storefront/lib/to-storefront-product";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";
import type { PublicProductRow } from "@/server/repositories/product.repository";

/**
 * La ficha lee del repositorio, no de `fetch`: sin esto Next la prerenderiza en
 * el build y un cambio de precio o de stock no llegaría nunca a la tienda.
 */
export const revalidate = 60;

/** El segmento es texto libre de la URL; el slug canónico es minúsculas sin bordes. */
function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

type ProductResult =
  | { status: "ok"; row: PublicProductRow }
  | { status: "not-found" }
  | { status: "error" };

/**
 * `cache` deduplica la consulta entre `generateMetadata` y la página: son dos
 * llamadas del mismo request, no dos viajes a Neon.
 *
 * El import del repositorio va diferido dentro del `try` porque el cliente
 * Drizzle lee `DATABASE_URL` al evaluarse el módulo: un entorno sin configurar
 * reventaría en el `import` en vez de caer al estado de error (mismo patrón que
 * `/products/page.tsx`).
 */
const loadProduct = cache(async (slug: string): Promise<ProductResult> => {
  try {
    const productRepository = await import(
      "@/server/repositories/product.repository"
    );
    const row = await productRepository.findPublicBySlug(slug);

    return row ? { status: "ok", row } : { status: "not-found" };
  } catch (error) {
    console.error(`Ficha ${slug}: no se pudo cargar el producto`, error);

    return { status: "error" };
  }
});

/**
 * `try/catch` propio y `[]` como peor caso (AC10): un bloque secundario no
 * convierte una ficha válida en pantalla de error.
 */
async function loadSimilar(
  row: PublicProductRow,
): Promise<StorefrontProduct[]> {
  try {
    const productRepository = await import(
      "@/server/repositories/product.repository"
    );
    const rows = await productRepository.findSimilar(
      row,
      SIMILAR_PRODUCTS_LIMIT,
    );

    return rows.map(toStorefrontProduct);
  } catch (error) {
    console.error(
      `Ficha ${row.slug}: no se pudieron cargar los productos parecidos`,
      error,
    );

    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadProduct(normalizeSlug(slug));

  // Un slug inexistente o un fallo de BD no deben romper el head (AC6): la
  // página decide después si es 404 o error.
  if (result.status !== "ok") {
    return { title: "Producto no disponible" };
  }

  const product = toStorefrontProduct(result.row);
  const description =
    product.description ??
    `${product.name} en ${product.categoryName}. Envío en 24 h y garantía de 2 años.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      type: "website",
      // Sin `metadataBase` una ruta relativa no resuelve: solo se publica la
      // imagen real del producto, que ya es absoluta.
      images: product.imageUrl
        ? [{ url: product.imageUrl, alt: product.name }]
        : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const result = await loadProduct(normalizeSlug(slug));

  // Fuera de cualquier `try`: `notFound()` lanza, y dentro del catch del fallo
  // de BD se volvería el error genérico (AC2 vs AC8).
  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
        <p className="rounded-2xl border border-dashed border-destructive/40 p-8 text-center text-sm text-destructive">
          No pudimos cargar este producto. Actualiza la página en un momento.
        </p>
      </div>
    );
  }

  const product = toStorefrontProduct(result.row);
  const similar = await loadSimilar(result.row);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6 md:gap-24 md:py-12">
      <ProductDetail product={product} />
      <SimilarProducts products={similar} />
    </div>
  );
}
