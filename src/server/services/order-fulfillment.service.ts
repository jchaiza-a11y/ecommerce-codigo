import "server-only";

import type Stripe from "stripe";

import { AUDIT_ACTIONS, buildAuditLogInsert } from "@/lib/audit";
import { runBatch, type PgStatement } from "@/server/db/batch";
import * as financeRepository from "@/server/repositories/finance.repository";
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

type OrderLine = { productId: string; quantity: number; unitPriceCents: number };

type PricedLine = {
  item: OrderLine;
  product: Awaited<ReturnType<typeof productRepository.findById>>;
};

/**
 * Cada línea del pedido con el producto que referencia. Un único fetch alimenta
 * dos cálculos —la sobreventa (stock) y el COGS (`costCents`)—: repetirlo sería
 * una segunda ronda de N consultas por el mismo dato.
 */
async function loadPricedLines(
  items: readonly OrderLine[],
): Promise<PricedLine[]> {
  const products = await Promise.all(
    items.map((item) => productRepository.findById(item.productId)),
  );

  return items.map((item, index) => ({ item, product: products[index] }));
}

/**
 * Líneas cuyo stock actual ya no cubre lo comprado. No frena el fulfillment —el
 * cliente ya pagó— pero queda anotado para que operaciones lo resuelva.
 */
function findOversoldLines(lines: readonly PricedLine[]): OversoldLine[] {
  return lines.flatMap(({ item, product }) => {
    const available = product?.stock ?? 0;

    return available < item.quantity
      ? [{ productId: item.productId, requested: item.quantity, available }]
      : [];
  });
}

/**
 * Un producto que ya no se puede leer (retirado con soft delete) cuenta como
 * línea sin costo, no como costo cero: el COGS no debe dar por respaldada una
 * venta cuyo costo desconoce.
 */
function toLedgerLines(
  lines: readonly PricedLine[],
): financeRepository.LedgerLine[] {
  return lines.map(({ item, product }) => ({
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    costCents: product?.costCents ?? null,
  }));
}

/**
 * Marca el pedido como pagado, descuenta el stock, registra el ledger de
 * Finanzas y audita, todo en un único `batch` (CLAUDE.md §4.9).
 *
 * La idempotencia es doble: el pre-chequeo de `pending` corta el caso normal, y
 * cada sentencia se defiende sola del caso de dos entregas simultáneas, que el
 * pre-chequeo por sí solo no cubre —guarda SQL en las de pedido y stock, índice
 * único parcial más `onConflictDoNothing()` en las de ledger (014 §Notas)—. Los
 * descuentos van antes que el `buildMarkPaid` porque su guarda es justamente
 * que el pedido siga en `pending`.
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

  const pricedLines = await loadPricedLines(detail.items);
  const oversold = findOversoldLines(pricedLines);
  // La tarifa se lee antes de componer el batch: dentro de él no se puede
  // alimentar una sentencia con el resultado de otra (003 §8.5).
  const { shippingCostCents } = await financeRepository.getSettings();
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
    // Ledger de Finanzas (014): el ingreso y sus dos egresos nacen con el pago,
    // sin paso manual. Van en el mismo batch, así que un fallo aquí revierte el
    // pedido entero y Stripe reintenta el evento completo.
    financeRepository.buildIncomeInsert(detail),
    financeRepository.buildCogsInsert(detail, toLedgerLines(pricedLines)),
    financeRepository.buildShippingInsert(detail, shippingCostCents),
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
