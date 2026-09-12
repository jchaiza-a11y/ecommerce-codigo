import type { BatchItem } from "drizzle-orm/batch";

import { db } from "./index";

/**
 * Una sentencia Drizzle pendiente de ejecutar, apta para `db.batch()`.
 *
 * El driver `neon-http` no soporta `db.transaction()` (lanza "No transactions
 * support in neon-http driver"), así que la atomicidad exigida por CLAUDE.md
 * §4.9 —mutación y `audit_logs` en la misma transacción— se consigue con
 * `db.batch()`, que Neon ejecuta como una única transacción HTTP: si una
 * sentencia falla, revierten todas (003 §8.5).
 */
export type PgStatement = BatchItem<"pg">;

/**
 * `db.batch()` exige una tupla no vacía en su tipo, mientras que los llamadores
 * componen arrays de longitud variable (n roles a insertar, log opcional). El
 * estrechamiento se hace aquí, una sola vez, tras comprobar en runtime que hay
 * al menos una sentencia.
 */
export async function runBatch(
  statements: readonly PgStatement[],
): Promise<void> {
  if (statements.length === 0) {
    return;
  }

  await db.batch(statements as unknown as [PgStatement, ...PgStatement[]]);
}
