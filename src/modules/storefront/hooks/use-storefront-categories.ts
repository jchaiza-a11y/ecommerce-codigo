"use client";

import { useQuery } from "@tanstack/react-query";

import { catalogKeys } from "@/modules/storefront/constants";
import { getStorefrontCategories } from "@/modules/storefront/services/catalog.service";

export function useStorefrontCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: getStorefrontCategories,
    // La taxonomía cambia con muy baja frecuencia: no tiene sentido refetchear
    // en cada apertura del buscador.
    staleTime: 5 * 60 * 1000,
  });
}
