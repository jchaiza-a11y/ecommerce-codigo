"use client";

import { useQuery } from "@tanstack/react-query";

import { savedCardKeys } from "@/modules/profile/constants";
import { getSavedCards } from "@/modules/profile/services/saved-card.service";

/**
 * Tarjetas guardadas del usuario en sesión.
 *
 * `enabled` cubre al visitante anónimo del carrito: sin sesión el endpoint
 * responde 401 y la consulta no debe llegar a dispararse (AC9).
 */
export function useSavedCards(enabled = true) {
  return useQuery({
    queryKey: savedCardKeys.list(),
    queryFn: getSavedCards,
    enabled,
  });
}
