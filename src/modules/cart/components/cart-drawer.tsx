"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { isOptimizableImageUrl } from "@/lib/image";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  selectCartCount,
  selectCartSubtotalCents,
  useCartStore,
} from "@/modules/cart/store/cart.store";
import { SavedCardPicker } from "@/modules/checkout/components/saved-card-picker";
import { useCreateCheckoutSession } from "@/modules/checkout/hooks/use-create-checkout-session";
import { formatPrice } from "@/modules/products/constants";
import { useSavedCards } from "@/modules/profile/hooks/use-saved-cards";
import type { SavedCard } from "@/modules/profile/schemas/saved-card.schema";
import { PRODUCT_IMAGE_FALLBACK } from "@/modules/storefront/constants";

type SavedCardSlotProps = {
  cards: readonly SavedCard[];
  isPending: boolean;
  isError: boolean;
  value: string | null;
  onChange: (savedCardId: string | null) => void;
  disabled: boolean;
};

/**
 * Estados de carga y error del selector. Un fallo al listar las tarjetas no
 * bloquea la compra —se paga con una nueva— pero se dice, no se esconde.
 */
function SavedCardSlot({
  cards,
  isPending,
  isError,
  value,
  onChange,
  disabled,
}: SavedCardSlotProps) {
  if (isPending) {
    return <Skeleton className="h-9 w-full rounded-lg" aria-busy />;
  }

  if (isError) {
    return (
      <p className="text-xs text-muted-foreground">
        No pudimos cargar tus tarjetas guardadas. Podrás pagar con una nueva.
      </p>
    );
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <SavedCardPicker
      cards={cards}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const setOpen = useCartStore((state) => state.setOpen);
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const count = useCartStore(selectCartCount);
  const subtotalCents = useCartStore(selectCartSubtotalCents);
  const { mutate: startCheckout, isPending } = useCreateCheckoutSession();
  const { isSignedIn } = useAuth();

  // AC9: un visitante anónimo no ve el selector ni dispara la consulta, y las
  // tarjetas solo se piden con el carrito abierto, no en cada página.
  const cardsQuery = useSavedCards(Boolean(isSignedIn) && isOpen);
  const cards = cardsQuery.data ?? [];

  // `undefined` = el usuario todavía no ha elegido, así que vale la más
  // reciente (AC9). Derivarlo en vez de sincronizarlo con un efecto evita el
  // repintado extra en cuanto llega la lista.
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const selectedCardId = choice === undefined ? (cards[0]?.id ?? null) : choice;

  // El drawer se monta una sola vez, en el layout del storefront: es el punto
  // de rehidratación del carrito persistido (004 §8.4).
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  // Solo `productId` y `quantity`: el precio del carrito es de presentación y
  // el servidor lo recalcula contra `products` (008 AC2). El carrito no se
  // vacía aquí —el pago aún no ocurrió—, sino en `/checkout/success`.
  const handleCheckout = () => {
    startCheckout(
      {
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        // Sin tarjeta elegida el body no lleva el campo: Checkout ocultará las
        // guardadas y pedirá una nueva (AC11).
        savedCardId: selectedCardId ?? undefined,
      },
      {
        // Destino externo (Stripe): `router.push` no sirve, tiene que salir de
        // la app. `assign` deja la tienda en el historial para el botón atrás.
        onSuccess: ({ url }) => window.location.assign(url),
      },
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tu carrito</SheetTitle>
          <SheetDescription>
            {count === 0
              ? "Todavía no has añadido nada."
              : `${count} ${count === 1 ? "artículo" : "artículos"} listos para pedir.`}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Añade productos desde la tienda y aparecerán aquí.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <ul className="flex flex-col gap-3 p-4">
              <AnimatePresence initial={false}>
                {lines.map((line) => (
                  <motion.li
                    key={line.productId}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.18 }}
                    className="flex gap-3 rounded-xl p-2 ring-1 ring-foreground/10"
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={line.imageUrl ?? PRODUCT_IMAGE_FALLBACK}
                        alt={line.name}
                        fill
                        unoptimized={!isOptimizableImageUrl(line.imageUrl)}
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(line.priceCents)}
                      </p>

                      <div className="mt-auto flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          className="text-foreground"
                          aria-label={`Quitar una unidad de ${line.name}`}
                          onClick={() =>
                            setQuantity(line.productId, line.quantity - 1)
                          }
                        >
                          <Minus />
                        </Button>
                        <span
                          className="w-8 text-center text-sm tabular-nums"
                          aria-live="polite"
                        >
                          {line.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          className="text-foreground"
                          aria-label={`Añadir una unidad de ${line.name}`}
                          onClick={() =>
                            setQuantity(line.productId, line.quantity + 1)
                          }
                        >
                          <Plus />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="ml-auto text-muted-foreground"
                          aria-label={`Eliminar ${line.name} del carrito`}
                          onClick={() => removeLine(line.productId)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm font-medium tabular-nums">
                      {formatPrice(line.priceCents * line.quantity)}
                    </p>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </ScrollArea>
        )}

        <SheetFooter className="gap-3 border-t">
          {isSignedIn && lines.length > 0 ? (
            <SavedCardSlot
              cards={cards}
              isPending={cardsQuery.isPending}
              isError={cardsQuery.isError}
              value={selectedCardId}
              onChange={setChoice}
              disabled={isPending}
            />
          ) : null}

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-heading text-lg font-medium tabular-nums">
              {formatPrice(subtotalCents)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Impuestos y envío se calculan en el pago.
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={lines.length === 0 || isPending}
            onClick={handleCheckout}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Redirigiendo al pago…
              </>
            ) : (
              "Ir a pagar"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
