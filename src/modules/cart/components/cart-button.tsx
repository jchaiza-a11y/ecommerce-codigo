"use client";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  selectCartCount,
  useCartStore,
} from "@/modules/cart/store/cart.store";

export function CartButton() {
  const count = useCartStore(selectCartCount);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const setOpen = useCartStore((state) => state.setOpen);

  // Hasta que el carrito persistido se rehidrata, el badge no se pinta: el
  // servidor no puede conocer el `localStorage` del visitante (004 §10).
  const visibleCount = hasHydrated ? count : 0;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      className="relative"
      aria-label={
        visibleCount > 0
          ? `Abrir carrito, ${visibleCount} artículos`
          : "Abrir carrito"
      }
      onClick={() => setOpen(true)}
    >
      <ShoppingCart />
      {visibleCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white tabular-nums">
          {visibleCount > 99 ? "99+" : visibleCount}
        </span>
      )}
    </Button>
  );
}
