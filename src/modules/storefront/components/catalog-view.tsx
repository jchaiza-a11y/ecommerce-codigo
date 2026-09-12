"use client";

import { CatalogFilters } from "@/modules/storefront/components/catalog-filters";
import { CatalogResults } from "@/modules/storefront/components/catalog-results";
import { CatalogSort } from "@/modules/storefront/components/catalog-sort";
import { useCatalogFilters } from "@/modules/storefront/hooks/use-catalog-filters";
import { useCatalogProducts } from "@/modules/storefront/hooks/use-catalog-products";
import type { StorefrontCategory } from "@/modules/storefront/schemas/catalog.schema";

type CatalogViewProps = {
  categories: StorefrontCategory[];
  brands: string[];
  totalCatalog: number;
};

/**
 * Único componente cliente de `/products`: concentra el estado de la URL y el
 * fetching para que el aside, el orden y el grid compartan filtros sin
 * levantarlos a la página, que se queda como Server Component (005 §Notas).
 */
export function CatalogView({
  categories,
  brands,
  totalCatalog,
}: CatalogViewProps) {
  const {
    filters,
    hasFilters,
    toggleCategory,
    toggleBrand,
    togglePrice,
    toggleInStock,
    toggleOnSale,
    setSort,
    clearAll,
  } = useCatalogFilters();

  const query = useCatalogProducts(filters);

  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <CatalogFilters
        categories={categories}
        brands={brands}
        filters={filters}
        hasFilters={hasFilters}
        onToggleCategory={toggleCategory}
        onToggleBrand={toggleBrand}
        onTogglePrice={togglePrice}
        onToggleInStock={toggleInStock}
        onToggleOnSale={toggleOnSale}
        onClearAll={clearAll}
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {filters.q ? (
            <p className="text-sm text-muted-foreground">
              Resultados para{" "}
              <span className="font-medium text-foreground">
                “{filters.q}”
              </span>
            </p>
          ) : (
            <span />
          )}
          <CatalogSort value={filters.sort} onChange={setSort} />
        </div>

        <CatalogResults
          items={items}
          total={total}
          totalCatalog={totalCatalog}
          status={query.status}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          onRetry={() => void query.refetch()}
          onClearFilters={clearAll}
        />
      </div>
    </div>
  );
}
