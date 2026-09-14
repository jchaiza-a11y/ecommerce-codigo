import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getAuditLogs, getApiErrorMessage } = await import(
  "@/modules/audit-logs/services/audit-log.service.ts"
);

test.beforeEach(() => {
  apiMock.resetCalls();
});

// `toQueryParams` no está exportada (a diferencia de lo que dice el
// inventario): se cubre indirectamente a través de `getAuditLogs`, que es la
// única consumidora.

test("getAuditLogs() hits GET /api/admin/audit-logs and returns the response data", async () => {
  apiMock.on("get", async () => ({ data: [{ id: "log_1" }] }));

  assert.deepEqual(await getAuditLogs({ limit: 100 }), [{ id: "log_1" }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/admin/audit-logs");
});

test("getAuditLogs() omits undefined/null/empty filters from the query params", async () => {
  apiMock.on("get", async () => ({ data: [] }));

  await getAuditLogs({
    limit: 100,
    entityType: undefined,
    action: "",
    actorId: undefined,
  } as never);

  // `toQueryParams` pasa todo (menos `Date`) por `String(...)`, así que un
  // número también sale como string — a pesar de que el tipo de retorno diga
  // `Record<string, string | number>`. No afecta la petición real (axios
  // igual serializa el query string a texto), así que no es un bug real.
  const options = apiMock.argsFor("get")?.[1] as { params: Record<string, unknown> };
  assert.deepEqual(options.params, { limit: "100" });
});

test("getAuditLogs() keeps non-empty filters and serializes dates to ISO strings", async () => {
  apiMock.on("get", async () => ({ data: [] }));

  const from = new Date("2026-01-01T00:00:00.000Z");
  await getAuditLogs({ limit: 50, entityType: "product", from } as never);

  const options = apiMock.argsFor("get")?.[1] as { params: Record<string, unknown> };
  assert.deepEqual(options.params, {
    limit: "50",
    entityType: "product",
    from: from.toISOString(),
  });
});

test("getApiErrorMessage() returns the API's error message when present", () => {
  const error = new AxiosError("fail");
  error.response = { data: { error: "Filtro inválido" }, status: 400, statusText: "", headers: {}, config: {} as never };

  assert.equal(getApiErrorMessage(error, "fallback"), "Filtro inválido");
});

test("getApiErrorMessage() falls back for a non-axios error", () => {
  assert.equal(getApiErrorMessage(new Error("boom"), "fallback"), "fallback");
});
