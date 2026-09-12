import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Base sin `.default()`: aplicar defaults aquí haría que `.partial()` los
// reinyectara en el PATCH y reseteara en silencio los campos no enviados.
const categoryFields = {
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio")
    .max(100, "Máximo 100 caracteres")
    .regex(SLUG_PATTERN, "Solo minúsculas, números y guiones"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").nullish(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0, "Debe ser 0 o mayor"),
};

export const createCategorySchema = z.object({
  ...categoryFields,
  isActive: categoryFields.isActive.default(true),
  sortOrder: categoryFields.sortOrder.default(0),
});

export const updateCategorySchema = z
  .object(categoryFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios que guardar");

export const categoryIdSchema = z.uuid("Identificador inválido");

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type CreateCategoryValues = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
