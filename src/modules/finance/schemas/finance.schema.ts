import { z } from "zod";

// Las columnas son `integer` (int4): un valor mayor reventaría en Postgres con
// un 500 en vez de un 400 explicando el límite.
const MAX_INT4 = 2_147_483_647;

// Dinero en centavos y siempre entero (CLAUDE.md §6): `z.int()` rechaza los
// decimales que dejaría pasar un `z.number().min(0)`, así que un 12,5 no llega
// a la base redondeado en silencio.
const amountCents = z
  .int("Debe ser un número entero de centavos")
  .min(0, "Debe ser 0 o mayor")
  .max(MAX_INT4, "El importe es demasiado alto");

export const updateSettingsSchema = z.object({
  shippingCostCents: amountCents,
});

export const updateProductCostSchema = z.object({
  costCents: amountCents,
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UpdateProductCostInput = z.infer<typeof updateProductCostSchema>;

/**
 * Filtros de los listados de ingresos y egresos (015). Mismo patrón que
 * `auditLogFiltersSchema`: el rango acota la consulta en el servidor y `limit`
 * viene con techo porque el ledger crece con cada pedido pagado.
 *
 * El `origin` no entra aquí: se filtra por columna en la tabla del panel sobre
 * las filas ya cargadas (015 §Notas).
 */
export const financeListFiltersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type FinanceListFiltersInput = z.input<typeof financeListFiltersSchema>;
export type FinanceListFilters = z.infer<typeof financeListFiltersSchema>;
