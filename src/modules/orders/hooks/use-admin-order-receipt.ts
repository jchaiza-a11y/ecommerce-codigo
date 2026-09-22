"use client";

import { useQuery } from "@tanstack/react-query";

import { adminOrderKeys } from "@/modules/orders/constants";
import { getAdminOrderReceipt } from "@/modules/orders/services/admin-order.service";

/**
 * La boleta cuesta una llamada a Stripe, así que solo se resuelve con el
 * diálogo abierto y sobre un pedido pagado (§Decisiones 5). Se pide al abrir y
 * no al pulsar: un `window.open()` después de un `await` lo bloquea el
 * navegador (009 §Notas).
 */
export function useAdminOrderReceipt(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: adminOrderKeys.receipt(orderId),
    queryFn: () => getAdminOrderReceipt(orderId),
    enabled: enabled && orderId.length > 0,
    // Stripe puede tardar en publicar la boleta: un reintento agresivo no la
    // adelanta y multiplica la latencia del diálogo.
    retry: false,
  });
}
