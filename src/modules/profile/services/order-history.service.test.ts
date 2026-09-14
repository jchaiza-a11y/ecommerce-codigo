import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getOrderHistory, getOrderReceipt } = await import(
  "@/modules/profile/services/order-history.service.ts"
);

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getOrderHistory() hits GET /api/orders and unwraps items from the response", async () => {
  apiMock.on("get", async () => ({ data: { items: [{ id: "order_1" }] } }));

  const range = { from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z" };
  assert.deepEqual(await getOrderHistory(range), [{ id: "order_1" }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/orders");
});

test("getOrderReceipt() hits the order's receipt sub-resource", async () => {
  apiMock.on("get", async () => ({ data: { url: "https://pay.stripe.com/receipts/abc" } }));

  const receipt = await getOrderReceipt("order_1");

  assert.deepEqual(receipt, { url: "https://pay.stripe.com/receipts/abc" });
  assert.equal(apiMock.argsFor("get")?.[0], "/api/orders/order_1/receipt");
});
