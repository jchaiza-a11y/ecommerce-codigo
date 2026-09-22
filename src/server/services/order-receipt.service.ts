import "server-only";

import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import type { Order } from "@/server/db/schema/order";
import * as orderRepository from "@/server/repositories/order.repository";

export type ResolveOrderReceiptResult =
  | { status: "ok"; url: string | null }
  /** También cubre "el pedido es de otro usuario": no se confirma su existencia (AC8). */
  | { status: "not_found" }
  | { status: "stripe_unavailable" };

/** Lo único que la resolución necesita del pedido, venga de donde venga. */
type ReceiptOrder = Pick<Order, "status" | "stripePaymentIntentId">;

/**
 * Resuelve la boleta del pedido contra Stripe.
 *
 * 008 crea la Checkout Session sin `invoice_creation`, así que no hay factura
 * ni `hosted_invoice_url`: la única boleta es el `receipt_url` del cargo, que
 * se alcanza expandiendo `latest_charge` del PaymentIntent.
 *
 * `receipt_url` es nullable y tarda en aparecer, de ahí el `url: null` en vez
 * de un error cuando aún no existe (AC7).
 *
 * El pedido llega ya cargado: quién puede verlo —su dueño o un admin con
 * `orders.view`— lo decide el llamador, y la parte de Stripe es la misma
 * (012 §Decisiones 5).
 */
async function resolveReceiptUrl(
  found: ReceiptOrder | undefined,
): Promise<ResolveOrderReceiptResult> {
  // Un pedido inexistente y uno sin pagar se responden igual: solo un pedido
  // pagado tiene boleta, así que pedir otra cosa es una URL manipulada.
  if (!found || found.status !== "paid") {
    return { status: "not_found" };
  }

  if (!found.stripePaymentIntentId) {
    return { status: "ok", url: null };
  }

  let intent: Stripe.PaymentIntent;

  try {
    intent = await stripe.paymentIntents.retrieve(found.stripePaymentIntentId, {
      expand: ["latest_charge"],
    });
  } catch (error) {
    // El fallo no se traga: se traduce a un estado propio que el handler
    // convierte en 502, porque el origen es Stripe y no la aplicación.
    console.error("resolveReceiptUrl", error);

    return { status: "stripe_unavailable" };
  }

  const charge = intent.latest_charge;

  // `expand` puede no haberse aplicado si el intent no tiene cargo todavía; un
  // string suelto significa que no viene expandido y no hay url que leer.
  if (!charge || typeof charge === "string") {
    return { status: "ok", url: null };
  }

  return { status: "ok", url: charge.receipt_url };
}

/** Autoservicio (009): la propiedad del pedido va en el `where`, no en un `if`. */
export async function resolveOrderReceiptUrl(
  userId: string,
  orderId: string,
): Promise<ResolveOrderReceiptResult> {
  return resolveReceiptUrl(
    await orderRepository.findByIdAndUserId(orderId, userId),
  );
}

/**
 * Variante del panel (012): sin dueño en el `where` porque el permiso
 * `orders.view` ya autoriza a ver cualquier pedido; el estado `paid` sigue
 * siendo condición.
 */
export async function resolveAdminOrderReceiptUrl(
  orderId: string,
): Promise<ResolveOrderReceiptResult> {
  return resolveReceiptUrl(await orderRepository.findById(orderId));
}
