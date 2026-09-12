import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .optional()
  .catch(undefined);

/**
 * Filtros de la bitácora. `limit` viene acotado: la tabla crece sin fin y una
 * consulta sin techo tumbaría la respuesta.
 */
export const auditLogFiltersSchema = z.object({
  entityType: optionalText,
  action: optionalText,
  actorId: z.uuid("Identificador de actor inválido").optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type AuditLogFiltersInput = z.input<typeof auditLogFiltersSchema>;
export type AuditLogFilters = z.infer<typeof auditLogFiltersSchema>;
