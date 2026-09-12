"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import {
  catalogKeys,
  CATALOG_PER_PAGE,
} from "@/modules/storefront/constants";
import type { CatalogFiltersState } from "@/modules/storefront/hooks/use-catalog-filters";
import { getStorefrontProducts } from "@/modules/storefront/services/catalog.service";
import type { StorefrontProductParams } from "@/modules/storefront/services/catalog.service";

/** El estado de la URL se traduce una sola vez al contrato del endpoint. */
function toParams(filters: CatalogFiltersState): StorefrontProductParams {
  return {
    category: filters.categories,
    brand: filters.brands,
    price: filters.price ?? undefined,
    inStock: filters.inStock || undefined,
    onSale: filters.onSale || undefined,
    q: filters.q || undefined,
    sort: filters.sort,
    perPage: CATALOG_PER_PAGE,
  };
}

/**
 * "Ver más" acumula páginas en vez de sustituirlas (AC6), de ahí el
 * `useInfiniteQuery`: la respuesta ya trae `page` y `totalPages`, así que el
 * cursor sale del propio contrato sin estado extra en el componente.
 */
export function useCatalogProducts(filters: CatalogFiltersState) {
  const params = toParams(filters);

  return useInfiniteQuery({
    queryKey: catalogKeys.list(params),
    queryFn: ({ pageParam }) =>
      getStorefrontProducts({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}
