"use client";

import { useQuery } from "@tanstack/react-query";

import { useDebounce } from "@/hooks/use-debounce";
import {
  catalogKeys,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_LENGTH,
  SEARCH_RESULT_LIMIT,
} from "@/modules/storefront/constants";
import { getStorefrontProducts } from "@/modules/storefront/services/catalog.service";

/**
 * El debounce vive aquí y no en el input para que cualquier consumidor del
 * buscador herede el mismo comportamiento sin repetirlo (AC5).
 */
export function useProductSearch(term: string) {
  const debouncedTerm = useDebounce(term.trim(), SEARCH_DEBOUNCE_MS);

  return useQuery({
    queryKey: catalogKeys.productSearch(debouncedTerm),
    queryFn: () =>
      getStorefrontProducts({
        q: debouncedTerm,
        perPage: SEARCH_RESULT_LIMIT,
      }),
    enabled: debouncedTerm.length >= SEARCH_MIN_LENGTH,
  });
}
