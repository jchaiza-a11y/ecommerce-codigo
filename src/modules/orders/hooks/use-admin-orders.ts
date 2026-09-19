"use client";

import { useQuery } from "@tanstack/react-query";

import { adminOrderKeys, type AdminOrderQuery } from "@/modules/orders/constants";
import { getAdminOrders } from "@/modules/orders/services/admin-order.service";

/**
 * Listado de administración. Los tres filtros se resuelven en el servidor
 * (§Decisiones 2), así que forman parte de la clave de caché: cambiar uno es
 * otra consulta, no un filtrado en memoria.
 */
export function useAdminOrders(query: AdminOrderQuery) {
  return useQuery({
    queryKey: adminOrderKeys.list(query),
    queryFn: () => getAdminOrders(query),
  });
}
