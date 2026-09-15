import { mock } from "node:test";

/**
 * Reemplaza `@/lib/stripe` ANTES de importar el archivo bajo prueba —
 * evita además el throw real de `lib/stripe.ts` si `STRIPE_SECRET_KEY` no
 * está seteada.
 *
 * @example
 * mockStripe({ checkout: { sessions: { create: async () => fakeSession } } });
 * const { createCheckoutSession } = await import("@/server/services/checkout.service.ts");
 */
export function mockStripe(overrides: Record<string, unknown>) {
  mock.module("@/lib/stripe", {
    namedExports: { stripe: overrides },
  });
}
