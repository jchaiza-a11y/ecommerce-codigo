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
    namedExports: { db: overrides },
  });
}

/**
 * `db.<método>().<método>()...` con Drizzle siempre tiene la misma forma:
 * cada paso (`select`, `from`, `where`, `orderBy`, `limit`, `leftJoin`,
 * `insert`, `values`, `returning`, `batch`...) devuelve algo encadenable, y
 * solo al final se resuelve (`await`) al array de filas. Este stub reproduce
 * exactamente eso sin conocer la forma de cada repositorio: cualquier
 * propiedad es una función que devuelve el mismo stub, y `await stub`
 * resuelve al valor configurado con `.set()`.
 *
 * Se instala UNA sola vez por archivo de test (`mock.module` no afecta un
 * módulo ya importado), y el repositorio bajo prueba se importa UNA sola vez
 * después — cada `test()` cambia el resultado con `.set()`/`.forbid()` antes
 * de llamar a la función.
 *
 * @example
 * const db = mockDbQuery();
 * const { findAll, findBySlugs } = await import("@/server/repositories/role.repository.ts");
 *
 * test("findAll() ...", async () => {
 *   db.set([{ id: "role_1", name: "Admin" }]);
 *   assert.deepEqual(await findAll(), [{ id: "role_1", name: "Admin" }]);
 * });
 *
 * test("findBySlugs([]) no consulta", async () => {
 *   db.forbid(); // cualquier acceso a `db` revienta el test
 *   assert.deepEqual(await findBySlugs([]), []);
 * });
 *
 * `db.calls` registra cada paso de la cadena (`{ method, args }`, en orden) —
 * sirve para verificar valores que el repositorio arma antes de pasarlos a
 * Drizzle (ej. los defaults `?? null` de un `.values(...)`), no la SQL final.
 */
export function mockDbQuery(initial: unknown = []) {
  const state: { mode: "value" | "throw"; value: unknown } = {
    mode: "value",
    value: initial,
  };
  const calls: { method: string; args: unknown[] }[] = [];

  const stub: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (state.mode === "throw") {
          throw new Error(
            `db.${String(prop)} no debía llamarse — se esperaba un corte antes de tocar la base de datos`,
          );
        }

        if (prop === "then") {
          return (
            onFulfilled: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => Promise.resolve(state.value).then(onFulfilled, onRejected);
        }

        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return stub;
        };
      },
    },
  );

  mockDb(stub as Record<string, unknown>);

  return {
    /** Las próximas llamadas a `db` resuelven a `value` cuando se esperen. */
    set(value: unknown) {
      state.mode = "value";
      state.value = value;
    },
    /** Cualquier acceso a `db` lanza — para probar guardas que no deben consultar. */
    forbid() {
      state.mode = "throw";
    },
    /** Cadena de llamadas registrada hasta ahora: `{ method, args }[]`. */
    calls,
    /** Últimos argumentos pasados a `method` en la cadena, o `undefined`. */
    argsFor(method: string): unknown[] | undefined {
      return calls.find((call) => call.method === method)?.args;
    },
    /** Limpia el registro — llamar en `test.beforeEach` si se usa `calls`/`argsFor`. */
    resetCalls() {
      calls.length = 0;
    },
  };
}
