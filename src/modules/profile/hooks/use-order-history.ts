"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { orderHistoryKeys } from "@/modules/profile/constants";
import type { OrderHistoryQuery } from "@/modules/profile/schemas/order-history.schema";
import { getOrderHistory } from "@/modules/profile/services/order-history.service";

/**
 * `keepPreviousData` evita el parpadeo a vacío al cambiar de rango: la lista
 * anterior se mantiene mientras llega la nueva en vez de caer al skeleton.
 */
export function useOrderHistory(range: OrderHistoryQuery) {
  return useQuery({
    queryKey: orderHistoryKeys.history(range),
    queryFn: () => getOrderHistory(range),
    placeholderData: keepPreviousData,
  });
}
