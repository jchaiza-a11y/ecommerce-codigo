import { mock } from "node:test";

/**
 * Reemplaza `@clerk/nextjs/server` ANTES de importar el archivo bajo
 * prueba. Necesario para cualquier módulo que dependa de `@/lib/auth`
 * (importa `auth` de Clerk): sin este mock, cargar el módulo real dispara
 * la cadena de `@clerk/backend`, que no carga bajo `node --test` (uno de sus
 * imports de `next/package.json` no trae el atributo `type: "json"` que
 * exige el ESM estricto de Node fuera del bundler de Next).
 *
 * @example
 * mockClerkAuth({ userId: "user_123" });
 * const { getCurrentUserState } = await import("@/lib/auth.ts");
 */
export function mockClerkAuth(result: { userId: string | null }) {
  mock.module("@clerk/nextjs/server", {
    exports: { auth: async () => result },
  });
}
