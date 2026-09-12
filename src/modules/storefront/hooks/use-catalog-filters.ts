"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  PRICE_RANGES,
  STOREFRONT_SORTS,
  type PriceRangeId,
  type StorefrontSort,
} from "@/modules/storefront/schemas/catalog.schema";

export type CatalogFiltersState = {
  categories: string[];
  brands: string[];
  price: PriceRangeId | null;
  inStock: boolean;
  onSale: boolean;
  q: string;
  sort: StorefrontSort;
};

const EMPTY_STATE: CatalogFiltersState = {
  categories: [],
  brands: [],
  price: null,
  inStock: false,
  onSale: false,
  q: "",
  sort: "newest",
};

function parseList(value: string | null): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Un valor desconocido en la URL no rompe la vista: cae al filtro apagado. */
function parsePrice(value: string | null): PriceRangeId | null {
  return PRICE_RANGES.find((range) => range.id === value)?.id ?? null;
}

function parseSort(value: string | null): StorefrontSort {
  return STOREFRONT_SORTS.find((sort) => sort === value) ?? EMPTY_STATE.sort;
}

function toSearchParams(state: CatalogFiltersState): string {
  const params = new URLSearchParams();

  if (state.q) params.set("q", state.q);
  if (state.categories.length > 0)
    params.set("category", state.categories.join(","));
  if (state.brands.length > 0) params.set("brand", state.brands.join(","));
  if (state.price) params.set("price", state.price);
  if (state.inStock) params.set("inStock", "true");
  if (state.onSale) params.set("onSale", "true");
  if (state.sort !== EMPTY_STATE.sort) params.set("sort", state.sort);

  return params.toString();
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

/**
 * La URL es el estado de los filtros (AC2/AC3). Se escribe con
 * `window.history.replaceState` y no con `router.replace` a propósito: el
 * segundo revalida el Server Component de `/products` y refetchearía las
 * facetas del aside en cada clic de chip (005 §Notas).
 */
export function useCatalogFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<CatalogFiltersState>(
    () => ({
      categories: parseList(searchParams.get("category")),
      brands: parseList(searchParams.get("brand")),
      price: parsePrice(searchParams.get("price")),
      inStock: searchParams.get("inStock") === "true",
      onSale: searchParams.get("onSale") === "true",
      q: searchParams.get("q")?.trim() ?? "",
      sort: parseSort(searchParams.get("sort")),
    }),
    [searchParams],
  );

  const apply = useCallback(
    (next: CatalogFiltersState) => {
      const query = toSearchParams(next);

      window.history.replaceState(
        null,
        "",
        query ? `${pathname}?${query}` : pathname,
      );
    },
    [pathname],
  );

  const toggleCategory = useCallback(
    (slug: string) =>
      apply({ ...filters, categories: toggleValue(filters.categories, slug) }),
    [apply, filters],
  );

  const toggleBrand = useCallback(
    (brand: string) =>
      apply({ ...filters, brands: toggleValue(filters.brands, brand) }),
    [apply, filters],
  );

  /** El precio es de selección única: repulsar el tramo activo lo desactiva. */
  const togglePrice = useCallback(
    (price: PriceRangeId) =>
      apply({ ...filters, price: filters.price === price ? null : price }),
    [apply, filters],
  );

  const toggleInStock = useCallback(
    () => apply({ ...filters, inStock: !filters.inStock }),
    [apply, filters],
  );

  const toggleOnSale = useCallback(
    () => apply({ ...filters, onSale: !filters.onSale }),
    [apply, filters],
  );

  const setSort = useCallback(
    (sort: StorefrontSort) => apply({ ...filters, sort }),
    [apply, filters],
  );

  const clearAll = useCallback(() => apply(EMPTY_STATE), [apply]);

  // El orden no cuenta como filtro activo: "Limpiar" habla de lo que recorta el
  // catálogo, no de cómo se ordena (AC5).
  const hasFilters =
    filters.categories.length > 0 ||
    filters.brands.length > 0 ||
    filters.price !== null ||
    filters.inStock ||
    filters.onSale ||
    filters.q.length > 0;

  return {
    filters,
    hasFilters,
    toggleCategory,
    toggleBrand,
    togglePrice,
    toggleInStock,
    toggleOnSale,
    setSort,
    clearAll,
  };
}
