import "server-only";

import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import * as orderRepository from "@/server/repositories/order.repository";

export type ResolveOrderReceiptResult =
  | { status: "ok"; url: string | null }
  /** También cubre "el pedido es de otro usuario": no se confirma su existencia (AC8). */
  | { status: "not_found" }
  | { status: "stripe_unavailable" };

/**
 * Resuelve la boleta del pedido contra Stripe.
 *
 * 008 crea la Checkout Session sin `invoice_creation`, así que no hay factura
 * ni `hosted_invoice_url`: la única boleta es el `receipt_url` del cargo, que
 * se alcanza expandiendo `latest_charge` del PaymentIntent.
 *
 * `receipt_url` es nullable y tarda en aparecer, de ahí el `url: null` en vez
 * de un error cuando aún no existe (AC7).
 */
export async function resolveOrderReceiptUrl(
  userId: string,
  orderId: string,
): Promise<ResolveOrderReceiptResult> {
  const found = await orderRepository.findByIdAndUserId(orderId, userId);

  // Un pedido ajeno y un pedido sin pagar se responden igual: el historial solo
  // lista pagados, así que pedir la boleta de otra cosa es una URL manipulada.
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
    console.error("resolveOrderReceiptUrl", error);

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
