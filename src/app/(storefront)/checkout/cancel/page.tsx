import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pago cancelado",
  description: "Has salido del pago sin completarlo.",
};

/**
 * Destino de `cancel_url` (008 T18). No toca el pedido: la Checkout Session
 * queda abierta y Stripe la expira sola a las 24 h, así que el pedido `pending`
 * simplemente nunca se cumple. El carrito se conserva intacto para reintentar.
 */
export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
      <ShoppingBag className="size-10 text-muted-foreground" />

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Has cancelado el pago
        </h1>
        <p className="text-sm text-muted-foreground">
          No se ha cobrado nada. Tu carrito sigue como lo dejaste, puedes
          retomarlo cuando quieras.
        </p>
      </div>

      <Button asChild size="lg" className="rounded-full px-8">
        <Link href="/products">Volver al catálogo</Link>
      </Button>
    </div>
  );
}
