import { z } from "zod";

// Import de tipo: se borra en compilación, así que el bundle de cliente no
// arrastra Drizzle por reexportar la fila del repositorio (mismo patrón que
// `modules/products/types/product.types.ts`).
import type { InventoryItem } from "@/server/repositories/product.repository";

export type { InventoryItem };

/**
 * Tope de ambos campos. No lo exige ningún check de la base: existe porque las
 * columnas son `integer` (int4) y un pegado accidental de quince dígitos
 * tumbaría el batch con un error de desbordamiento ilegible en vez de un 400
 * que explique el límite (013 §Notas).
 */
const MAX_UNITS = 100_000;

/**
 * Reposición: solo suma. Restar stock sigue siendo cosa del formulario de
 * producto (013 §Alcance), así que `0` y los negativos se rechazan aquí y el
 * check `products_stock_non_negative` nunca llega a dispararse.
 */
export const adjustStockSchema = z.object({
  quantity: z
    .int("La cantidad debe ser un número entero")
    .positive("Debe ser 1 o mayor")
    .max(MAX_UNITS, `Máximo ${MAX_UNITS} unidades por reposición`),
});

/** Umbral de alerta: `0` es válido y significa "avisar solo si se agota". */
export const updateThresholdSchema = z.object({
  threshold: z
    .int("El umbral debe ser un número entero")
    .min(0, "Debe ser 0 o mayor")
    .max(MAX_UNITS, `Máximo ${MAX_UNITS} unidades`),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;
