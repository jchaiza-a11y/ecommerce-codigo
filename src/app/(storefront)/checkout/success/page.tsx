import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUserState } from "@/lib/auth";
import { ClearCartOnSuccess } from "@/modules/checkout/components/clear-cart-on-success";
import { formatPrice } from "@/modules/products/constants";
import type { OrderStatus } from "@/server/db/schema/order";
import * as orderRepository from "@/server/repositories/order.repository";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: "Resumen de tu compra.",
};

type SearchParams = Promise<{ session_id?: string }>;

const HEADINGS: Record<
  OrderStatus,
  { icon: typeof CheckCircle2; title: string; description: string }
> = {
  paid: {
    icon: CheckCircle2,
    title: "¡Gracias por tu compra!",
    description: "Hemos recibido tu pago y ya estamos preparando el pedido.",
  },
  // AC9: el webhook es la única fuente de verdad del pago, así que esta página
  // informa y no muta nada. Un pago con método asíncrono puede tardar.
  pending: {
    icon: Loader2,
    title: "Estamos confirmando tu pago",
    description:
      "Tu pedido está registrado. En cuanto el pago se confirme verás el estado actualizado aquí.",
  },
  failed: {
    icon: XCircle,
    title: "El pago no se completó",
    description:
      "No se ha cobrado nada. Puedes intentarlo de nuevo desde el carrito.",
  },
  canceled: {
    icon: XCircle,
    title: "El pedido se canceló",
    description: "No se ha cobrado nada por este pedido.",
  },
};

/**
 * Server Component de solo lectura (008 T16): resuelve el pedido por el
 * `session_id` de la URL contra Postgres, sin llamar a la API de Stripe y sin
 * escribir nada. Marcar el pago aquí perdería las compras de quien cierra la
 * pestaña antes de volver (docs/stripe/README.md §7).
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    notFound();
  }

  const state = await getCurrentUserState();

  if (state.status !== "ready") {
    redirect("/sign-in");
  }

  const found = await orderRepository.findByStripeCheckoutSessionId(sessionId);

  // Un `session_id` ajeno no revela nada: mismo 404 que uno inexistente.
  if (!found || found.userId !== state.user.id) {
    notFound();
  }

  const order = await orderRepository.findWithItems(found.id);

  if (!order) {
    notFound();
  }

  const heading = HEADINGS[order.status];
  const Icon = heading.icon;
  const isSettled = order.status !== "failed" && order.status !== "canceled";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
      {/* Stripe solo redirige aquí cuando acepta el pago: el carrito ya cumplió
          su función y se vacía salvo que el pedido haya fallado. */}
      {isSettled ? <ClearCartOnSuccess /> : null}

      <header className="flex flex-col items-center gap-3 text-center">
        <Icon
          className={
            order.status === "pending"
              ? "size-10 animate-spin text-muted-foreground"
              : "size-10 text-foreground"
          }
        />
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {heading.title}
        </h1>
        <p className="text-sm text-muted-foreground">{heading.description}</p>
      </header>

      <section
        aria-label="Resumen del pedido"
        className="flex flex-col gap-4 rounded-xl p-5 ring-1 ring-foreground/10"
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted-foreground">Nº de pedido</span>
          <span className="font-mono text-xs sm:text-sm">{order.id}</span>
        </div>

        <Separator />

        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 text-sm">
                {item.productName}
                <span className="text-muted-foreground"> × {item.quantity}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                {formatPrice(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <Separator />

        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium">Total</span>
          <span className="font-heading text-lg font-medium tabular-nums">
            {formatPrice(order.totalCents)}
          </span>
        </div>
      </section>

      <Button asChild size="lg" className="rounded-full px-8 self-center">
        <Link href="/products">Seguir comprando</Link>
      </Button>
    </div>
  );
}
