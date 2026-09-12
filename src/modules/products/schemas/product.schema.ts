import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Las columnas son `integer` (int4): un valor mayor reventaría en Postgres con
// un 500 en vez de un 400 explicando el límite.
const MAX_INT4 = 2_147_483_647;

// Base sin `.default()`: aplicar defaults aquí haría que `.partial()` los
// reinyectara en el PATCH y reseteara en silencio los campos no enviados.
const productFields = {
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(140, "Máximo 140 caracteres"),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio")
    .max(160, "Máximo 160 caracteres")
    .regex(SLUG_PATTERN, "Solo minúsculas, números y guiones"),
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(40, "Máximo 40 caracteres")
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().max(2000, "Máximo 2000 caracteres").nullish(),
  brand: z.string().trim().max(60, "Máximo 60 caracteres").nullish(),
  priceCents: z
    .int("El precio es obligatorio")
    .min(0, "Debe ser 0 o mayor")
    .max(MAX_INT4, "El precio es demasiado alto"),
  // Sin `.refine()` cruzado contra `priceCents` (§8.5): en un PATCH parcial el
  // precio vigente no viaja en el payload, así que la coherencia se resuelve en
  // la UI, no en el schema.
  compareAtPriceCents: z
    .int("El precio de comparación debe ser un número")
    .min(0, "Debe ser 0 o mayor")
    .max(MAX_INT4, "El precio es demasiado alto")
    .nullish(),
  stock: z
    .int("El stock es obligatorio")
    .min(0, "Debe ser 0 o mayor")
    .max(MAX_INT4, "El stock es demasiado alto"),
  categoryId: z.uuid("Selecciona una categoría"),
  // El formulario deja el campo vacío como `""`; se acepta y se normaliza a
  // `null` para no obligar al usuario a borrar el campo entero.
  imageUrl: z
    .union([z.url("Debe ser una URL válida"), z.literal("")])
    .nullish()
    .transform((value) => (value ? value : null)),
  isActive: z.boolean(),
};

export const createProductSchema = z.object({
  ...productFields,
  stock: productFields.stock.default(0),
  isActive: productFields.isActive.default(true),
});

export const updateProductSchema = z
  .object(productFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios que guardar");

export const productIdSchema = z.uuid("Identificador inválido");

export type CreateProductInput = z.input<typeof createProductSchema>;
export type CreateProductValues = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
