import "server-only";

import type Stripe from "stripe";

import { getAppUrl } from "@/lib/app-url";
import { stripe } from "@/lib/stripe";
import type { CheckoutSessionInput } from "@/modules/checkout/schemas/checkout.schema";
import type { Product } from "@/server/db/schema/product";
import * as orderRepository from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";
import { ensureStripeCustomer } from "@/server/services/saved-card.service";

/** Moneda del negocio, alineada con `formatPrice()` y el default de `orders`. */
const CURRENCY = "eur";

export type CheckoutActor = {
  /** `users.id` local, no el `clerkId`: es la FK de `orders.user_id`. */
  id: string;
  email: string;
};

export type CreateCheckoutSessionResult =
  | { status: "created"; url: string; orderId: string }
  | { status: "unavailable"; message: string; productName: string };

type PricedLine = {
  product: Product;
  quantity: number;
};

/**
 * Revalida cada línea contra la fila viva de `products`. El precio y el stock
 * que mandó el navegador se descartan por completo: el carrito es un snapshot
 * de presentación, no una fuente de verdad (008 AC2).
 */
async function priceLines(
  items: CheckoutSessionInput["items"],
): Promise<PricedLine[] | { productName: string; message: string }> {
  const products = await Promise.all(
    items.map((item) => productRepository.findById(item.productId)),
  );

  const lines: PricedLine[] = [];

  for (const [index, item] of items.entries()) {
    const found = products[index];

    if (!found || !found.isActive) {
      return {
        productName: found?.name ?? "Un producto del carrito",
        message: `${found?.name ?? "Un producto del carrito"} ya no está disponible`,
      };
    }

    if (found.stock < item.quantity) {
      return {
        productName: found.name,
        message:
          found.stock === 0
            ? `${found.name} se ha agotado`
            : `Solo quedan ${found.stock} unidades de ${found.name}`,
      };
    }

    lines.push({ product: found, quantity: item.quantity });
  }

  return lines;
}

/**
 * `price_data` inline en vez de un `price` pre-creado en Stripe: el catálogo
 * vive en Postgres y no se sincroniza (docs/stripe/README.md §1). Sin
 * `payment_method_types`, para que Stripe resuelva los métodos habilitados en
 * el Dashboard (§10).
 */
function toLineItems(
  lines: readonly PricedLine[],
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return lines.map(({ product, quantity }) => ({
    price_data: {
      currency: CURRENCY,
      product_data: { name: product.name },
      unit_amount: product.priceCents,
    },
    quantity,
  }));
}

export type CreateCheckoutSessionOptions = {
  /**
   * El comprador eligió una de sus tarjetas guardadas. No fija *cuál* —Checkout
   * no admite preselección (010 §Decisión 3)—, solo decide si las guardadas se
   * ofrecen o si tiene que teclear una nueva.
   */
  useSavedCards: boolean;
};

export async function createCheckoutSession(
  actor: CheckoutActor,
  items: CheckoutSessionInput["items"],
  { useSavedCards }: CreateCheckoutSessionOptions,
): Promise<CreateCheckoutSessionResult> {
  const priced = await priceLines(items);

  if (!Array.isArray(priced)) {
    return {
      status: "unavailable",
      message: priced.message,
      productName: priced.productName,
    };
  }

  const totalCents = priced.reduce(
    (total, line) => total + line.product.priceCents * line.quantity,
    0,
  );

  // El id se genera aquí porque `client_reference_id` lo necesita antes de que
  // exista la fila, y `stripe_checkout_session_id` es notNull: primero Stripe,
  // después el insert. Una sesión huérfana (insert fallido) expira sola a las
  // 24 h y nunca se paga, porque el cliente no llega a recibir su `url`.
  const orderId = crypto.randomUUID();
  const appUrl = getAppUrl();

  // Todo comprador pasa a tener Customer (010 T19): es lo que permite listar
  // sus tarjetas guardadas en Checkout. Sustituye a `customer_email`, que Stripe
  // rechaza si se envía junto a `customer`.
  const customerId = await ensureStripeCustomer(actor);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: toLineItems(priced),
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancel`,
    client_reference_id: orderId,
    customer: customerId,
    // Las guardadas nacen con `allow_redisplay: "always"`, así que filtrar por
    // `limited` es lo que las oculta cuando el cliente pide otra tarjeta (AC11).
    saved_payment_method_options: {
      allow_redisplay_filters: useSavedCards ? ["always"] : ["limited"],
    },
  });

  if (!session.url) {
    throw new Error(
      `La Checkout Session ${session.id} se creó sin url de redirección`,
    );
  }

  await orderRepository.createWithItems(
    {
      id: orderId,
      userId: actor.id,
      status: "pending",
      totalCents,
      currency: CURRENCY,
      stripeCheckoutSessionId: session.id,
    },
    priced.map(({ product, quantity }) => ({
      productId: product.id,
      // Snapshot: el pedido conserva nombre y precio aunque el catálogo cambie.
      productName: product.name,
      unitPriceCents: product.priceCents,
      quantity,
    })),
  );

  return { status: "created", url: session.url, orderId };
}
