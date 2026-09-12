"use client";

import { Loader2, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATALOG_PER_PAGE } from "@/modules/storefront/constants";
import { ProductCard } from "@/modules/storefront/components/product-card";
import { ProductGridSkeleton } from "@/modules/storefront/components/product-grid-skeleton";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

type CatalogResultsProps = {
  items: StorefrontProduct[];
  /** Total que devuelve el endpoint con los filtros aplicados. */
  total: number;
  /** Total del catálogo sin filtrar, calculado en servidor (005 §Notas). */
  totalCatalog: number;
  status: "pending" | "error" | "success";
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onClearFilters: () => void;
};

export function CatalogResults({
  items,
  total,
  totalCatalog,
  status,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  onClearFilters,
}: CatalogResultsProps) {
  if (status === "pending") {
    return <ProductGridSkeleton count={CATALOG_PER_PAGE} />;
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-destructive/40 p-10 text-center">
        <p className="text-sm text-destructive">
          No pudimos cargar el catálogo. Inténtalo de nuevo.
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-10 text-center">
        <SearchX className="size-8 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-heading text-base font-medium">
            Nada con estos filtros
          </p>
          <p className="text-sm text-muted-foreground">
            Prueba a quitar alguno para ver más productos.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClearFilters}>
          Limpiar filtros
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{total}</span>{" "}
        de <span className="tabular-nums">{totalCatalog}</span> productos
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={index < 3}
          />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full px-8"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage && <Loader2 className="animate-spin" />}
            Ver más
          </Button>
        </div>
      )}
    </div>
  );
}
