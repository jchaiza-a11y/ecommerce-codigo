"use client";

import { useEffect } from "react";

import { useCartStore } from "@/modules/cart/store/cart.store";

/**
 * Vacía el carrito una vez que la compra está confirmada. Es lo único cliente
 * de la página de éxito: la hoja del pedido la pinta el Server Component.
 *
 * El store está persistido con `skipHydration`, así que hay que rehidratar
 * antes de limpiar; si no, el `clear()` se aplicaría sobre un estado vacío en
 * memoria y `localStorage` conservaría las líneas viejas.
 */
export function ClearCartOnSuccess() {
  useEffect(() => {
    let cancelled = false;

    // `rehydrate()` puede devolver `void` según el storage: se normaliza a
    // promesa para encadenar el vaciado en ambos casos.
    void Promise.resolve(useCartStore.persist.rehydrate()).then(() => {
      if (!cancelled) {
        useCartStore.getState().clear();
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
