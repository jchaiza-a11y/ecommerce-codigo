import { z } from "zod";

import type { PaymentMethod } from "@/server/db/schema/payment-method";

/**
 * El identificador de la Checkout Session vuelve en la url de retorno, así que
 * llega del navegador y se valida como cualquier otra entrada: el prefijo `cs_`
 * descarta de entrada un `pm_`/`cus_` colado a mano. Que la sesión sea **suya**
 * no lo decide el schema, sino el servicio contra Stripe (AC7).
 */
export const confirmSetupSchema = z.object({
  setupSessionId: z.string().startsWith("cs_").max(255),
});

export type ConfirmSetupInput = z.infer<typeof confirmSetupSchema>;

/** `params.id` del DELETE, que en Next.js 16 llega como `Promise`. */
export const savedCardIdSchema = z.uuid();

/**
 * La sesión de setup no lleva datos: el usuario sale de la sesión de Clerk. El
 * body se valida igualmente (CLAUDE.md §4.4) y `.strict()` rechaza cualquier
 * campo colado, en vez de ignorarlo en silencio.
 */
export const setupSessionSchema = z.object({}).strict();

/**
 * Contrato de salida. Derivado de la fila de Drizzle (CLAUDE.md §4.5) con dos
 * cambios: `createdAt` viaja como ISO porque un `Date` no sobrevive a
 * `JSON.stringify`, y ni `stripe_payment_method_id` ni `user_id` se serializan
 * nunca al cliente.
 */
export type SavedCard = Pick<
  PaymentMethod,
  "id" | "brand" | "last4" | "expMonth" | "expYear"
> & { createdAt: string };

export type SavedCardsResponse = { items: SavedCard[] };
export type SavedCardResponse = { item: SavedCard };
export type CardSetupSessionResponse = { url: string };
