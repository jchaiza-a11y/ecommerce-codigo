"use client";

import { useQuery } from "@tanstack/react-query";

import { inventoryKeys } from "@/modules/inventory/constants";
import { getInventory } from "@/modules/inventory/services/inventory.service";

/**
 * Listado completo del inventario (013 T17). Sin parámetros: el orden lo fija
 * el `ORDER BY` del repositorio y el filtro "solo stock bajo" es client-side
 * (§Decisiones 8), así que una sola entrada de caché sirve a toda la vista.
 */
export function useInventory() {
  return useQuery({
    queryKey: inventoryKeys.lists(),
    queryFn: getInventory,
  });
}
