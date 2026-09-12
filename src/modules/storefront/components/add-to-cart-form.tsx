"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/modules/cart/store/cart.store";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

/** Mismo techo que el `clamp` del store: el selector no ofrece lo que se recortaría. */
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

/**
 * Único islote cliente de la ficha: el resto es servidor. El stepper repite el
 * del drawer a propósito — dos consumidores todavía no justifican extraerlo
 * (§6 DRY a la tercera).
 */
export function AddToCartForm({ product }: { product: StorefrontProduct }) {
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const existingLine = useCartStore((state) =>
    state.lines.find((line) => line.productId === product.id),
  );
  const addLine = useCartStore((state) => state.addLine);
  const setLineQuantity = useCartStore((state) => state.setQuantity);
  const setOpen = useCartStore((state) => state.setOpen);

  const [quantity, setQuantity] = useState(MIN_QUANTITY);

  // El selector refleja el carrito real: si el producto ya está ahí, arranca
  // en esa cantidad (no en 1) y "Añadir al carrito" pasa a fijarla en vez de
  // sumarla. `existingLine` siempre da vacío hasta que el store rehidrata
  // (`skipHydration`, 004 §8.4); `syncedQuantity` es la fuente que ya vimos
  // una vez rehidratado, para no reajustar `quantity` en cada render aunque
  // el usuario ya la haya tocado con el stepper (ajuste de estado durante el
  // render, no en un efecto: react.dev/learn/you-might-not-need-an-effect).
  const [syncedQuantity, setSyncedQuantity] = useState<number | null>(null);
  const sourceQuantity = hasHydrated
    ? (existingLine?.quantity ?? MIN_QUANTITY)
    : null;

  if (sourceQuantity !== null && sourceQuantity !== syncedQuantity) {
    setSyncedQuantity(sourceQuantity);
    setQuantity(sourceQuantity);
  }

  // Sin unidades no hay nada que elegir: el selector ni se pinta (AC5).
  if (!product.inStock) {
    return (
      <Button type="button" size="lg" disabled className="w-full rounded-full">
        Sin stock
      </Button>
    );
  }

  const step = (delta: number) =>
    setQuantity((current) =>
      Math.min(Math.max(current + delta, MIN_QUANTITY), MAX_QUANTITY),
    );

  const handleAdd = () => {
    if (existingLine) {
      // Ya está en el carrito: el selector fija la cantidad total, no la suma.
      setLineQuantity(product.id, quantity);
      setOpen(true);
      return;
    }

    addLine(
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
      },
      quantity,
    );
  };

  const buttonLabel = existingLine ? "Actualizar carrito" : "Añadir al carrito";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-1 self-start rounded-full p-1 ring-1 ring-foreground/10">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-foreground"
          disabled={quantity <= MIN_QUANTITY}
          aria-label="Quitar una unidad"
          onClick={() => step(-1)}
        >
          <Minus />
        </Button>
        <span
          className="w-8 text-center text-sm tabular-nums"
          aria-live="polite"
        >
          {quantity}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-foreground"
          disabled={quantity >= MAX_QUANTITY}
          aria-label="Añadir una unidad"
          onClick={() => step(1)}
        >
          <Plus />
        </Button>
      </div>

      <Button
        type="button"
        size="lg"
        className="flex-1 rounded-full"
        aria-label={
          existingLine
            ? `Actualizar ${product.name} en el carrito`
            : `Añadir ${product.name} al carrito`
        }
        onClick={handleAdd}
      >
        <ShoppingBag />
        {buttonLabel}
      </Button>
    </div>
  );
}
