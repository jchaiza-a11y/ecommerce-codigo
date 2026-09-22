import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getAdminOrders, getAdminOrderDetail, getAdminOrderReceipt } =
  await import("@/modules/orders/services/admin-order.service.ts");

test.beforeEach(() => {
  apiMock.resetCalls();
});

function paramsOfLastGet(): Record<string, unknown> {
  const options = apiMock.argsFor("get")?.[1] as {
    params: Record<string, unknown>;
  };

  return options.params;
}

test("getAdminOrders() hits GET /api/admin/orders and returns the body as is", async () => {
  const body = { items: [{ id: "order_1" }], truncated: false };
  apiMock.on("get", async () => ({ data: body }));

  assert.deepEqual(await getAdminOrders({}), body);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/admin/orders");
});

test("getAdminOrders() sends no query params when there are no filters", async () => {
  apiMock.on("get", async () => ({ data: { items: [], truncated: false } }));

  await getAdminOrders({});

  assert.deepEqual(paramsOfLastGet(), {});
});

test("getAdminOrders() keeps the filters that carry a value", async () => {
  apiMock.on("get", async () => ({ data: { items: [], truncated: false } }));

  await getAdminOrders({
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    status: "paid",
    customer: "ana",
  });

  assert.deepEqual(paramsOfLastGet(), {
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    status: "paid",
    customer: "ana",
  });
});

// El endpoint responde 400 a `customer=""` a propósito (no lleva `.catch()`):
// si el service lo mandara, limpiar el campo rompería el listado.
test("getAdminOrders() drops an empty customer instead of sending customer=''", async () => {
  apiMock.on("get", async () => ({ data: { items: [], truncated: false } }));

  await getAdminOrders({ customer: "", status: "paid" });

  assert.deepEqual(paramsOfLastGet(), { status: "paid" });
});

test("getAdminOrders() drops a whitespace-only customer", async () => {
  apiMock.on("get", async () => ({ data: { items: [], truncated: false } }));

  await getAdminOrders({ customer: "   " });

  assert.deepEqual(paramsOfLastGet(), {});
});

test("getAdminOrders() drops undefined filters", async () => {
  apiMock.on("get", async () => ({ data: { items: [], truncated: false } }));

  await getAdminOrders({ from: undefined, to: undefined, status: undefined });

  assert.deepEqual(paramsOfLastGet(), {});
});

test("getAdminOrderDetail() hits the order's own route", async () => {
  apiMock.on("get", async () => ({ data: { id: "order_1", items: [] } }));

  assert.deepEqual(await getAdminOrderDetail("order_1"), {
    id: "order_1",
    items: [],
  });
  assert.equal(apiMock.argsFor("get")?.[0], "/api/admin/orders/order_1");
});

test("getAdminOrderReceipt() hits the admin receipt route, not the self-service one", async () => {
  apiMock.on("get", async () => ({ data: { url: "https://stripe/receipt" } }));

  assert.deepEqual(await getAdminOrderReceipt("order_1"), {
    url: "https://stripe/receipt",
  });
  assert.equal(
    apiMock.argsFor("get")?.[0],
    "/api/admin/orders/order_1/receipt",
  );
});
