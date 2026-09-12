import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getRequestAuditContext } from "@/lib/audit";
import { stripe } from "@/lib/stripe";
import {
  fulfillCheckout,
  markOrderFailed,
  type FulfillmentContext,
  type FulfillmentOutcome,
} from "@/server/services/order-fulfillment.service";
import { savePaymentMethodFromSetupSession } from "@/server/services/saved-card.service";

const ORDER_NOT_FOUND_MESSAGE =
  "El pedido de esta sesión todavía no existe: reintentar";

/**
 * `order_not_found` devuelve 404 a propósito: si el evento adelanta al insert
 * del pedido, un 200 daría el pago por procesado para siempre. Con el 404,
 * Stripe reintenta con backoff y la siguiente entrega lo encuentra (008 §Notas).
 */
function toResponse(outcome: FulfillmentOutcome): NextResponse {
  if (outcome === "order_not_found") {
    return NextResponse.json(
      { error: ORDER_NOT_FOUND_MESSAGE },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 200 });
}

/**
 * Guarda la tarjeta cuando el usuario cierra la pestaña sin volver (010 AC4).
 *
 * Siempre 200, incluso si no hay nada que guardar: una sesión de setup no tiene
 * pedido detrás, así que un 404 no arreglaría nada y solo haría que Stripe
 * reintentase durante tres días (010 §Notas). El usuario que sí vuelve confirma
 * la misma sesión por `POST /api/profile/payment-methods`.
 */
async function handleSetupSession(
  session: Stripe.Checkout.Session,
): Promise<NextResponse> {
  const userId = session.client_reference_id;

  if (!userId) {
    console.error(
      `POST /api/webhooks/stripe — sesión de setup ${session.id} sin client_reference_id`,
    );

    return new NextResponse(null, { status: 200 });
  }

  const result = await savePaymentMethodFromSetupSession(session.id, userId);

  if (result.status !== "saved") {
    console.error(
      `POST /api/webhooks/stripe — sesión de setup ${session.id} sin tarjeta guardada (${result.status})`,
    );
  }

  return new NextResponse(null, { status: 200 });
}

async function handleSessionEvent(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  context: FulfillmentContext,
): Promise<NextResponse> {
  // La rama de setup va primero y es bloqueante: sin ella, una sesión sin
  // pedido caería en `fulfillCheckout`, devolvería `order_not_found` → 404 y
  // Stripe reintentaría el evento durante tres días (010 §Notas).
  if (session.mode === "setup") {
    return await handleSetupSession(session);
  }

  if (event.type === "checkout.session.async_payment_failed") {
    return toResponse(await markOrderFailed(session, context));
  }

  // `unpaid` en un `completed` es un método asíncrono todavía en curso: el
  // pedido se cumple cuando llegue `async_payment_succeeded`, no ahora.
  if (session.payment_status === "unpaid") {
    return new NextResponse(null, { status: 200 });
  }

  return toResponse(await fulfillCheckout(session, context));
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("POST /api/webhooks/stripe — firma o secreto ausentes");

    return NextResponse.json(
      { error: "Firma del webhook ausente" },
      { status: 400 },
    );
  }

  // Cuerpo crudo, obligatorio: `req.json()` reserializaría el payload y la
  // firma dejaría de cuadrar (docs/stripe/README.md §8.3).
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("POST /api/webhooks/stripe — firma inválida", error);

    return NextResponse.json(
      { error: "Firma del webhook inválida" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
        return await handleSessionEvent(
          event,
          event.data.object,
          getRequestAuditContext(request),
        );
      default:
        // Evento no suscrito: se acusa recibo para que Stripe no reintente.
        return new NextResponse(null, { status: 200 });
    }
  } catch (error) {
    console.error(`POST /api/webhooks/stripe — ${event.type}`, error);

    return NextResponse.json(
      { error: "No se pudo procesar el evento" },
      { status: 500 },
    );
  }
}
