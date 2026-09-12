import { z } from "zod";

/** Tope por línea, alineado con el `clampQuantity` del carrito. */
const MAX_QUANTITY_PER_LINE = 99;
const MAX_LINES = 50;

/**
 * El cliente solo declara **qué** y **cuánto**: el precio no viaja en el body y
 * se recalcula siempre contra `products` en el servidor (008 AC2). Un
 * `priceCents` manipulado en el localStorage no llega a Stripe.
 */
export const checkoutSessionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.int().min(1).max(MAX_QUANTITY_PER_LINE),
      }),
    )
    .min(1, "El carrito está vacío")
    .max(MAX_LINES, "Demasiadas líneas en el carrito")
    // Dos líneas del mismo producto esquivarían la validación de stock: cada
    // una pasaría el chequeo por separado y sumadas superarían las existencias.
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      { message: "Hay productos repetidos en el carrito" },
    ),
  /**
   * Tarjeta guardada con la que el cliente quiere pagar (010 §API). Ausente
   * significa "usar otra tarjeta" y Checkout no ofrecerá las guardadas; presente
   * y propia del usuario, sí. Es un `payment_methods.id` local, no un `pm_` de
   * Stripe: el id de Stripe no sale nunca del servidor.
   */
  savedCardId: z.uuid().optional(),
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

/** Respuesta del endpoint, compartida por el service del cliente. */
export type CheckoutSessionResponse = {
  url: string;
  orderId: string;
};
