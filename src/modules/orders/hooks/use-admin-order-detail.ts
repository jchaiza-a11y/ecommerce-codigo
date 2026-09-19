"use client";

import { useQuery } from "@tanstack/react-query";

import { adminOrderKeys } from "@/modules/orders/constants";
import { getAdminOrderDetail } from "@/modules/orders/services/admin-order.service";

/**
 * Líneas del pedido bajo demanda: traer el desglose de 500 pedidos para
 * enseñar uno multiplica las filas por nada (§Decisiones 4).
 */
export function useAdminOrderDetail(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: adminOrderKeys.detail(orderId),
    queryFn: () => getAdminOrderDetail(orderId),
    enabled: enabled && orderId.length > 0,
  });
}
