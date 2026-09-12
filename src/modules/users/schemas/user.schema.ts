import { z } from "zod";

// Base sin `.default()`: aplicar defaults aquí haría que `.partial()` los
// reinyectara en el PATCH y reseteara en silencio los campos no enviados.
const userFields = {
  email: z
    .email("Introduce un correo electrónico válido")
    .max(255, "Máximo 255 caracteres"),
  firstName: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  lastName: z.string().trim().max(80, "Máximo 80 caracteres").nullish(),
  isActive: z.boolean(),
};

const roleSlugs = z
  .array(z.string().trim().min(1))
  .min(1, "Selecciona al menos un rol");

export const createUserSchema = z.object({
  email: userFields.email,
  firstName: userFields.firstName,
  lastName: userFields.lastName,
  roleSlugs,
});

export const updateUserSchema = z
  .object({
    firstName: userFields.firstName,
    lastName: userFields.lastName,
    isActive: userFields.isActive,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios que guardar");

/** Reemplaza el set completo de roles: lo que no viene, se revoca. */
export const assignRolesSchema = z.object({ roleSlugs });

export const userIdSchema = z.uuid("Identificador inválido");

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRolesInput = z.infer<typeof assignRolesSchema>;
