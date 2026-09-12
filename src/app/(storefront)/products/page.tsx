import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { CatalogView } from "@/modules/storefront/components/catalog-view";
import { ProductGridSkeleton } from "@/modules/storefront/components/product-grid-skeleton";
import { CATALOG_PER_PAGE } from "@/modules/storefront/constants";
import { toStorefrontCategory } from "@/modules/storefront/lib/to-storefront-category";
import type { StorefrontCategory } from "@/modules/storefront/schemas/catalog.schema";

/**
 * Las facetas salen del repositorio, no de `fetch`: sin esto Next prerenderiza
 * la ruta en el build y una categoría o marca nueva no aparecería nunca.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Filtra el catálogo por categoría, precio, marca y disponibilidad.",
};

type Facets = {
  categories: StorefrontCategory[];
  brands: string[];
  totalCatalog: number;
};

type FacetsResult = { status: "ok"; data: Facets } | { status: "error" };

/**
 * El cliente Drizzle lee `DATABASE_URL` al evaluarse el módulo, así que el
 * import diferido mantiene el fallo dentro del `try` y la ruta cae a su estado
 * de error en vez de reventar en el `import` (mismo patrón que la landing).
 */
async function loadFacets(): Promise<FacetsResult> {
  try {
    const [categoryRepository, productRepository] = await Promise.all([
      import("@/server/repositories/category.repository"),
      import("@/server/repositories/product.repository"),
    ]);

    const [categories, brands, totalCatalog] = await Promise.all([
      categoryRepository.findActiveWithProductCount(),
      productRepository.findPublicBrands(),
      productRepository.countPublic({}),
    ]);

    return {
      status: "ok",
      data: {
        categories: categories.map(toStorefrontCategory),
        brands,
        totalCatalog,
      },
    };
  } catch (error) {
    console.error("Catálogo: no se pudieron cargar las facetas", error);

    return { status: "error" };
  }
}

/** `useCatalogFilters` usa `useSearchParams`: sin este límite el build falla. */
function CatalogSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <Skeleton className="h-96 rounded-2xl" />
      <ProductGridSkeleton count={CATALOG_PER_PAGE} />
    </div>
  );
}

export default async function ProductsPage() {
  const facets = await loadFacets();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Catálogo
        </h1>
        <p className="text-sm text-muted-foreground">
          Filtra por categoría, precio, marca y disponibilidad.
        </p>
      </header>

      {facets.status === "error" ? (
        <p className="rounded-2xl border border-dashed border-destructive/40 p-8 text-center text-sm text-destructive">
          No pudimos cargar el catálogo. Actualiza la página en un momento.
        </p>
      ) : (
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogView
            categories={facets.data.categories}
            brands={facets.data.brands}
            totalCatalog={facets.data.totalCatalog}
          />
        </Suspense>
      )}
    </div>
  );
}
