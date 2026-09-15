import { mock } from "node:test";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/**
 * Reemplaza `@/lib/axios` (la instancia `api` que usa todo `*.service.ts` de
 * cliente) ANTES de importar el archivo bajo prueba. Cada método HTTP no
 * configurado con `.on()` lanza en vez de devolver `undefined` en silencio,
 * para que un test que olvidó configurar la respuesta falle con un mensaje
 * claro en vez de un `TypeError` críptico más abajo.
 *
 * @example
 * const apiMock = mockApi();
 * const { getProducts } = await import("@/modules/products/services/product.service.ts");
 *
 * apiMock.on("get", async () => ({ data: [{ id: "p1" }] }));
 * assert.deepEqual(await getProducts(), [{ id: "p1" }]);
 * assert.equal(apiMock.argsFor("get")?.[0], "/api/products");
 */
export function mockApi() {
  const handlers: Partial<Record<HttpMethod, (...args: unknown[]) => unknown>> = {};
  const calls: { method: HttpMethod; args: unknown[] }[] = [];

  const api = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return async (...args: unknown[]) => {
          calls.push({ method: prop as HttpMethod, args });
          const handler = handlers[prop as HttpMethod];

          if (!handler) {
            throw new Error(
              `api.${prop} no tiene respuesta configurada — usa apiMock.on("${prop}", ...)`,
            );
          }

          return handler(...args);
        };
      },
    },
  );

  mock.module("@/lib/axios", { namedExports: { api } });

  return {
    /** Configura qué devuelve (o lanza) el próximo `api.<method>(...)`. */
    on(method: HttpMethod, handler: (...args: unknown[]) => unknown) {
      handlers[method] = handler;
    },
    calls,
    argsFor(method: HttpMethod): unknown[] | undefined {
      return calls.find((call) => call.method === method)?.args;
    },
    resetCalls() {
      calls.length = 0;
    },
  };
}
