import { mock } from "node:test";

/**
 * Reemplaza `@/server/db` (Drizzle) ANTES de importar el archivo bajo
 * prueba — `mock.module` no afecta imports ya cargados. La forma de `db`
 * varía por repositorio (`.select().from().where()`, `.insert()...`, etc.),
 * así que no hay un fake genérico razonable: cada test pasa el fragmento de
 * API que su función usa.
 *
 * @example
 * mockDb({ select: () => ({ from: () => ({ where: async () => [row] }) }) });
 * const { findById } = await import("@/server/repositories/product.repository.ts");
 */
export function mockDb(overrides: Record<string, unknown>) {
  mock.module("@/server/db", {
    exports: { db: overrides },
  });
}
