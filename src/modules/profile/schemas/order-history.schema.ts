import { z } from "zod";

import type { Order } from "@/server/db/schema/order";
import type { OrderItem } from "@/server/db/schema/order-item";

/**
 * Tope duro del periodo consultable (AC3). 400 días cubre "el año pasado
 * completo" con holgura sin dejar que una sola llamada barra el histórico
 * entero de un cliente antiguo.
 */
export const MAX_RANGE_DAYS = 400;

const MAX_RANGE_MS = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;

export const RANGE_ORDER_MESSAGE =
  "La fecha final debe ser posterior a la inicial";
export const RANGE_SPAN_MESSAGE = `El periodo no puede superar los ${MAX_RANGE_DAYS} días`;

/**
 * `from` y `to` son instantes absolutos en ISO, no fechas civiles: el preset
 * "mes actual" y el rango del formulario se resuelven en el navegador, así el
 * servidor nunca tiene que adivinar la zona horaria del usuario. El intervalo
 * se interpreta como `[from, to)`.
 */
export const orderHistoryQuerySchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .refine((range) => Date.parse(range.to) > Date.parse(range.from), {
    message: RANGE_ORDER_MESSAGE,
    path: ["to"],
  })
  .refine(
    (range) => Date.parse(range.to) - Date.parse(range.from) <= MAX_RANGE_MS,
    { message: RANGE_SPAN_MESSAGE, path: ["to"] },
  );

export type OrderHistoryQuery = z.infer<typeof orderHistoryQuerySchema>;

export const orderIdSchema = z.uuid();

/**
 * Contrato de salida. Se deriva de las filas de Drizzle en vez de redeclararse
 * (CLAUDE.md §4.5): `createdAt` es lo único que cambia de forma, porque un
 * `Date` no sobrevive a `JSON.stringify` con su tipo.
 */
export type OrderHistoryLine = Pick<
  OrderItem,
  "id" | "productId" | "productName" | "unitPriceCents" | "quantity"
>;

export type OrderHistoryItem = Pick<
  Order,
  "id" | "status" | "totalCents" | "currency"
> & {
  createdAt: string;
  items: OrderHistoryLine[];
};

export type OrderHistoryResponse = { items: OrderHistoryItem[] };

/**
 * `null` no es un error: Stripe expone el `receipt_url` del cargo con algo de
 * retraso y puede no existir todavía (AC7).
 */
export type OrderReceiptResponse = { url: string | null };
