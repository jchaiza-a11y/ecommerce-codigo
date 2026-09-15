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
    namedExports: { auth: async () => result },
  });
}

/**
 * Mismo motivo que `mockClerkAuth`, para el lado de `clerkClient()` (usado
 * por `server/services/user-access.service.ts` para escribir
 * `publicMetadata`). Registra cada llamada a `users.updateUserMetadata` para
 * que el test pueda inspeccionar qué se le mandó a Clerk.
 *
 * @example
 * const clerk = mockClerkClient();
 * const { markPendingAccess } = await import("@/server/services/user-access.service.ts");
 * await markPendingAccess("clerk_1", ["manager"]);
 * assert.deepEqual(clerk.argsFor("updateUserMetadata")?.[1], { publicMetadata: {...} });
 */
export function mockClerkClient() {
  const calls: { method: string; args: unknown[] }[] = [];

  mock.module("@clerk/nextjs/server", {
    namedExports: {
      clerkClient: async () => ({
        users: {
          updateUserMetadata: async (...args: unknown[]) => {
            calls.push({ method: "updateUserMetadata", args });
            return {};
          },
        },
      }),
    },
  });

  return {
    calls,
    argsFor(method: string): unknown[] | undefined {
      return calls.find((call) => call.method === method)?.args;
    },
    resetCalls() {
      calls.length = 0;
    },
  };
}
