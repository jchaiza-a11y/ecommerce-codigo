"use client";

import { useQuery } from "@tanstack/react-query";

import { orderHistoryKeys } from "@/modules/profile/constants";
import { getOrderReceipt } from "@/modules/profile/services/order-history.service";

/**
 * La boleta cuesta una llamada a Stripe, así que solo se resuelve con el
 * diálogo abierto. Se resuelve al abrir y no al pulsar: un `window.open()`
 * después de un `await` lo bloquea el navegador (009 §Notas).
 */
export function useOrderReceipt(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: orderHistoryKeys.receipt(orderId),
    queryFn: () => getOrderReceipt(orderId),
    enabled: enabled && orderId.length > 0,
  });
}
