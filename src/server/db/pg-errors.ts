/**
 * Traducción de códigos de error de Postgres, compartida por los repositorios.
 * Vive en la capa de datos para que un solo cambio (p. ej. la profundidad de la
 * cadena `cause` de Drizzle) valga para todos y no diverjan entre repositorios.
 */

const PG_UNIQUE_VIOLATION = "23505";
// `ON DELETE RESTRICT` levanta `restrict_violation` (23001); un INSERT contra
// una FK inexistente levanta `foreign_key_violation` (23503). Ambos deben
// traducirse, o el caso real se escaparía como 500.
const PG_FOREIGN_KEY_VIOLATIONS = new Set(["23503", "23001"]);
const MAX_CAUSE_DEPTH = 5;

/**
 * Drizzle envuelve el error del driver en un `DrizzleQueryError`, así que el
 * código de Postgres viaja en `cause`, no en la raíz. Se recorre la cadena para
 * no filtrar detalles del driver al Route Handler.
 */
export function findPgError(
  error: unknown,
): { code: string; constraint?: string } | undefined {
  let current = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    const candidate = current as { code?: unknown; constraint?: unknown };

    if (typeof candidate.code === "string") {
      return {
        code: candidate.code,
        constraint:
          typeof candidate.constraint === "string"
            ? candidate.constraint
            : undefined,
      };
    }

    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

/**
 * Una verificación previa de unicidad + `insert` no es atómica: dos altas
 * simultáneas con el mismo valor pueden pasar la verificación y chocar contra el
 * índice único. El código del driver se interpreta aquí para no filtrar detalles
 * de Postgres al Route Handler.
 */
export function isUniqueViolation(error: unknown): boolean {
  return findPgError(error)?.code === PG_UNIQUE_VIOLATION;
}

/** FK con `ON DELETE RESTRICT` o referencia inexistente (002 §8.1). */
export function isForeignKeyViolation(error: unknown): boolean {
  const code = findPgError(error)?.code;

  return code !== undefined && PG_FOREIGN_KEY_VIOLATIONS.has(code);
}
