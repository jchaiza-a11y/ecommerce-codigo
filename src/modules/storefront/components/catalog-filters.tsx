"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CatalogFiltersState } from "@/modules/storefront/hooks/use-catalog-filters";
import {
  PRICE_RANGES,
  type PriceRangeId,
  type StorefrontCategory,
} from "@/modules/storefront/schemas/catalog.schema";

type CatalogFiltersProps = {
  categories: StorefrontCategory[];
  brands: string[];
  filters: CatalogFiltersState;
  hasFilters: boolean;
  onToggleCategory: (slug: string) => void;
  onToggleBrand: (brand: string) => void;
  onTogglePrice: (price: PriceRangeId) => void;
  onToggleInStock: () => void;
  onToggleOnSale: () => void;
  onClearAll: () => void;
};

/** Chip encendido/apagado: es el `Button` de shadcn cambiando de variante. */
function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "secondary"}
      aria-pressed={active}
      className="rounded-full"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function FilterGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export function CatalogFilters({
  categories,
  brands,
  filters,
  hasFilters,
  onToggleCategory,
  onToggleBrand,
  onTogglePrice,
  onToggleInStock,
  onToggleOnSale,
  onClearAll,
}: CatalogFiltersProps) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center justify-between gap-2 pb-4">
        <h2 className="font-heading text-sm font-semibold">Filtros</h2>
        {/* AC5: sin filtros activos no hay nada que limpiar. */}
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onClearAll}
          >
            <X />
            Limpiar
          </Button>
        )}
      </div>

      <ScrollArea className="lg:h-[calc(100vh-12rem)]">
        <div className="flex flex-col gap-6 lg:pr-4">
          <FilterGroup title="Categoría">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay categorías publicadas.
              </p>
            ) : (
              categories.map((category) => (
                <FilterChip
                  key={category.id}
                  active={filters.categories.includes(category.slug)}
                  label={`${category.name} (${category.productCount})`}
                  onClick={() => onToggleCategory(category.slug)}
                />
              ))
            )}
          </FilterGroup>

          <FilterGroup title="Precio">
            {PRICE_RANGES.map((range) => (
              <FilterChip
                key={range.id}
                active={filters.price === range.id}
                label={range.label}
                onClick={() => onTogglePrice(range.id)}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Marca">
            {brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay marcas registradas.
              </p>
            ) : (
              brands.map((brand) => (
                <FilterChip
                  key={brand}
                  active={filters.brands.includes(brand)}
                  label={brand}
                  onClick={() => onToggleBrand(brand)}
                />
              ))
            )}
          </FilterGroup>

          <FilterGroup title="Disponibilidad">
            <FilterChip
              active={filters.inStock}
              label="Con stock"
              onClick={onToggleInStock}
            />
            <FilterChip
              active={filters.onSale}
              label="En oferta"
              onClick={onToggleOnSale}
            />
          </FilterGroup>
        </div>
      </ScrollArea>
    </aside>
  );
}
