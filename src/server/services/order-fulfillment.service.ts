import "server-only";

import type Stripe from "stripe";

import { AUDIT_ACTIONS, buildAuditLogInsert } from "@/lib/audit";
import { runBatch, type PgStatement } from "@/server/db/batch";
import * as orderRepository from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";

/**
 * `order_not_found` se traduce en un 404, no en un 200: significa que el evento
 * llegó antes de que el insert del pedido terminase, y Stripe debe reintentar
 * (008 §Notas). `already_processed` sí es un 200: es el camino normal de un
 * reintento de un evento ya aplicado.
 */
export type FulfillmentOutcome =
  | "fulfilled"
  | "already_processed"
  | "order_not_found";

/** Contexto de red de la petición del webhook, para la traza de auditoría. */
export type FulfillmentContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  const paymentIntent = session.payment_intent;

  return typeof paymentIntent === "string"
    ? paymentIntent
    : (paymentIntent?.id ?? null);
}

type OversoldLine = {
  productId: string;
  requested: number;
  available: number;
};

/**
 * Líneas cuyo stock actual ya no cubre lo comprado. No frena el fulfillment —el
 * cliente ya pagó— pero queda anotado para que operaciones lo resuelva.
 */
async function findOversoldLines(
  items: readonly { productId: string; quantity: number }[],
): Promise<OversoldLine[]> {
  const products = await Promise.all(
    items.map((item) => productRepository.findById(item.productId)),
  );

  return items.flatMap((item, index) => {
    const available = products[index]?.stock ?? 0;

    return available < item.quantity
      ? [{ productId: item.productId, requested: item.quantity, available }]
      : [];
  });
}

/**
 * Marca el pedido como pagado, descuenta el stock y audita, todo en un único
 * `batch` (CLAUDE.md §4.9).
 *
 * La idempotencia es doble: el pre-chequeo de `pending` corta el caso normal, y
 * cada sentencia lleva su propia guarda SQL para el caso de dos entregas
 * simultáneas, que el pre-chequeo por sí solo no cubre. Los descuentos van
 * antes que el `buildMarkPaid` porque su guarda es justamente que el pedido siga
 * en `pending`.
 */
export async function fulfillCheckout(
  session: Stripe.Checkout.Session,
  context: FulfillmentContext,
): Promise<FulfillmentOutcome> {
  const existing = await orderRepository.findByStripeCheckoutSessionId(
    session.id,
  );

  if (!existing) {
    return "order_not_found";
  }

  if (existing.status !== "pending") {
    return "already_processed";
  }

  const detail = await orderRepository.findWithItems(existing.id);

  if (!detail) {
    return "order_not_found";
  }

  const oversold = await findOversoldLines(detail.items);
  const paymentIntentId = getPaymentIntentId(session);

  const statements: PgStatement[] = [
    ...detail.items.map((item) =>
      productRepository.buildStockDecrement(
        item.productId,
        item.quantity,
        detail.id,
      ),
    ),
    orderRepository.buildMarkPaid(detail.id, paymentIntentId),
    buildAuditLogInsert({
      // El pago es del cliente, no del sistema: dejar el actor en `null`
      // perdería la trazabilidad por usuario que da el índice `(actor_id, …)`.
      actorId: detail.userId,
      action: AUDIT_ACTIONS.ORDER_PAID,
      entityType: "order",
      entityId: detail.id,
      changes: { before: { status: "pending" }, after: { status: "paid" } },
      // Sin PII: ni email, ni dirección, ni datos de tarjeta (008 §Notas).
      metadata: {
        source: "stripe_webhook",
        totalCents: detail.totalCents,
        currency: detail.currency,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        ...(oversold.length > 0 ? { oversoldLines: oversold } : {}),
      },
      severity: oversold.length > 0 ? "warning" : "info",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    }),
  ];

  await runBatch(statements);

  return "fulfilled";
}

/**
 * Pago asíncrono rechazado: el pedido pasa a `failed` y el stock **no** se toca,
 * porque nunca llegó a descontarse (solo lo hace `fulfillCheckout`).
 */
export async function markOrderFailed(
  session: Stripe.Checkout.Session,
  context: FulfillmentContext,
): Promise<FulfillmentOutcome> {
  const existing = await orderRepository.findByStripeCheckoutSessionId(
    session.id,
  );

  if (!existing) {
    return "order_not_found";
  }

  if (existing.status !== "pending") {
    return "already_processed";
  }

  const paymentIntentId = getPaymentIntentId(session);

  await runBatch([
    orderRepository.buildMarkFailed(existing.id, paymentIntentId),
    buildAuditLogInsert({
      actorId: existing.userId,
      action: AUDIT_ACTIONS.ORDER_PAYMENT_FAILED,
      entityType: "order",
      entityId: existing.id,
      changes: { before: { status: "pending" }, after: { status: "failed" } },
      metadata: {
        source: "stripe_webhook",
        totalCents: existing.totalCents,
        currency: existing.currency,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
      },
      severity: "warning",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    }),
  ]);

  return "fulfilled";
}
