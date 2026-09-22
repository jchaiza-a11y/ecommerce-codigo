import { z } from "zod";

import type {
  FinanceExpenseCategory,
  FinanceIncomeCategory,
} from "@/modules/finance/types/finance.types";

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

/* -------------------------------------------------------------------------
 * CRUD manual de ingresos y egresos (016 §API).
 * ---------------------------------------------------------------------- */

/**
 * Los valores se declaran a mano y no con `pgEnum.enumValues`: importar el
 * schema Drizzle como valor arrastraría el ORM al bundle de cliente, y este
 * archivo lo consumen los formularios del panel. El `satisfies` ata la lista al
 * enum de Postgres, así que un valor inventado no compila; la omisión de uno
 * nuevo la delata el mapa de etiquetas de `constants.ts`, que es exhaustivo.
 */
export const FINANCE_INCOME_CATEGORIES = [
  "venta_extra",
  "financiero",
  "otro",
] as const satisfies readonly FinanceIncomeCategory[];

export const FINANCE_EXPENSE_CATEGORIES = [
  "alquiler",
  "servicios",
  "marketing",
  "personal",
  "otro",
] as const satisfies readonly FinanceExpenseCategory[];

const manualEntryFields = {
  amountCents,
  // El formulario entrega `YYYY-MM-DD` y la API un ISO 8601: `coerce` cubre los
  // dos sin que el llamador tenga que construir el `Date`. La unión previa es
  // obligatoria: `z.coerce.date()` a secas convierte `null` en el epoch y
  // guardaría un movimiento fechado en 1970 sin quejarse.
  occurredAt: z
    .union([z.string().trim().min(1), z.date()], "La fecha es obligatoria")
    .pipe(z.coerce.date("La fecha no es válida")),
  description: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
};

export const createManualIncomeSchema = z.object({
  ...manualEntryFields,
  category: z.enum(FINANCE_INCOME_CATEGORIES, "Selecciona una categoría"),
});

export const createManualExpenseSchema = z.object({
  ...manualEntryFields,
  category: z.enum(FINANCE_EXPENSE_CATEGORIES, "Selecciona una categoría"),
});

// El PATCH admite un subconjunto; el `refine` evita un update sin cambios, que
// escribiría una entrada de bitácora vacía.
const NO_CHANGES = "No hay cambios que guardar";

export const updateManualIncomeSchema = createManualIncomeSchema
  .partial()
  .refine((values) => Object.keys(values).length > 0, NO_CHANGES);

export const updateManualExpenseSchema = createManualExpenseSchema
  .partial()
  .refine((values) => Object.keys(values).length > 0, NO_CHANGES);

/** Identificador de una entrada del ledger, tal como llega en la ruta. */
export const financeEntryIdSchema = z.uuid("Identificador inválido");

// `input` es lo que teclea el formulario (fecha como texto); `infer`, lo que
// viaja a la API ya coercionado.
export type CreateManualIncomeInput = z.input<typeof createManualIncomeSchema>;
export type CreateManualIncomeValues = z.infer<typeof createManualIncomeSchema>;
export type UpdateManualIncomeInput = z.infer<typeof updateManualIncomeSchema>;

export type CreateManualExpenseInput = z.input<
  typeof createManualExpenseSchema
>;
export type CreateManualExpenseValues = z.infer<
  typeof createManualExpenseSchema
>;
export type UpdateManualExpenseInput = z.infer<
  typeof updateManualExpenseSchema
>;
