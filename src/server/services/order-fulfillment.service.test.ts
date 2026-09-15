import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

mockDbQuery(); // solo para que lib/audit -> audit-log.repository no explote al importar @/server/db

type FakeOrder = {
  id: string;
  status: string;
  userId: string;
  totalCents: number;
  currency: string;
  stripePaymentIntentId?: string | null;
};

let existingOrder: FakeOrder | undefined;
let orderDetail: (FakeOrder & { items: { productId: string; quantity: number }[] }) | undefined;
let productStocks: Record<string, number> = {};

const buildMarkPaidMock = mock.fn((orderId: string, paymentIntentId: string | null) => ({
  kind: "markPaid",
  orderId,
  paymentIntentId,
}));
const buildMarkFailedMock = mock.fn((orderId: string, paymentIntentId: string | null) => ({
  kind: "markFailed",
  orderId,
  paymentIntentId,
}));

mock.module("@/server/repositories/order.repository", {
  namedExports: {
    findByStripeCheckoutSessionId: async () => existingOrder,
    findWithItems: async () => orderDetail,
    buildMarkPaid: buildMarkPaidMock,
    buildMarkFailed: buildMarkFailedMock,
  },
});

const buildStockDecrementMock = mock.fn((productId: string, quantity: number, orderId: string) => ({
  kind: "decrement",
  productId,
  quantity,
  orderId,
}));

mock.module("@/server/repositories/product.repository", {
  namedExports: {
    findById: async (productId: string) =>
      productStocks[productId] !== undefined ? { stock: productStocks[productId] } : undefined,
    buildStockDecrement: buildStockDecrementMock,
  },
});

let batchedStatements: unknown[] = [];
mock.module("@/server/db/batch", {
  namedExports: {
    runBatch: async (statements: unknown[]) => {
      batchedStatements = statements;
    },
  },
});

const { fulfillCheckout, markOrderFailed } = await import(
  "@/server/services/order-fulfillment.service.ts"
);

const context = { ipAddress: null, userAgent: null };

test.beforeEach(() => {
  existingOrder = undefined;
  orderDetail = undefined;
  productStocks = {};
  batchedStatements = [];
  buildMarkPaidMock.mock.resetCalls();
  buildMarkFailedMock.mock.resetCalls();
  buildStockDecrementMock.mock.resetCalls();
});

test("fulfillCheckout() returns order_not_found when the session has no matching order", async () => {
  const result = await fulfillCheckout({ id: "cs_1" } as never, context);
  assert.equal(result, "order_not_found");
  assert.equal(batchedStatements.length, 0);
});

test("fulfillCheckout() returns already_processed when the order isn't pending", async () => {
  existingOrder = { id: "order_1", status: "paid", userId: "user_1", totalCents: 1000, currency: "eur" };

  const result = await fulfillCheckout({ id: "cs_1" } as never, context);
  assert.equal(result, "already_processed");
  assert.equal(batchedStatements.length, 0);
});

test("fulfillCheckout() returns order_not_found when the detail lookup fails after the status check", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = undefined;

  const result = await fulfillCheckout({ id: "cs_1" } as never, context);
  assert.equal(result, "order_not_found");
});

test("fulfillCheckout() batches one stock decrement per item plus markPaid plus the audit log", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = {
    ...existingOrder,
    items: [
      { productId: "prod_1", quantity: 2 },
      { productId: "prod_2", quantity: 1 },
    ],
  };
  productStocks = { prod_1: 10, prod_2: 10 };

  const result = await fulfillCheckout({ id: "cs_1", payment_intent: "pi_123" } as never, context);

  assert.equal(result, "fulfilled");
  assert.equal(batchedStatements.length, 4); // 2 decrements + markPaid + audit log
  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[0], "order_1");
  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[1], "pi_123");
});

test("fulfillCheckout() reads the payment intent id off an expanded object", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 1 }] };
  productStocks = { prod_1: 10 };

  await fulfillCheckout({ id: "cs_1", payment_intent: { id: "pi_expanded" } } as never, context);

  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[1], "pi_expanded");
});

test("fulfillCheckout() resolves a missing payment intent to null", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 1 }] };
  productStocks = { prod_1: 10 };

  await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[1], null);
});

test("fulfillCheckout() still fulfills an oversold line instead of blocking the payment", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 5 }] };
  productStocks = { prod_1: 1 }; // solo queda 1, se pidieron 5

  const result = await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.equal(result, "fulfilled");
  assert.equal(batchedStatements.length, 3); // 1 decrement + markPaid + audit log
});

test("markOrderFailed() returns order_not_found when there is no matching order", async () => {
  const result = await markOrderFailed({ id: "cs_1" } as never, context);
  assert.equal(result, "order_not_found");
});

test("markOrderFailed() returns already_processed when the order isn't pending", async () => {
  existingOrder = { id: "order_1", status: "failed", userId: "user_1", totalCents: 1000, currency: "eur" };

  const result = await markOrderFailed({ id: "cs_1" } as never, context);
  assert.equal(result, "already_processed");
});

test("markOrderFailed() batches the mark-failed statement plus the audit log, without touching stock", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };

  const result = await markOrderFailed({ id: "cs_1", payment_intent: "pi_123" } as never, context);

  assert.equal(result, "fulfilled");
  assert.equal(batchedStatements.length, 2); // markFailed + audit log
  assert.equal(buildStockDecrementMock.mock.calls.length, 0);
  assert.equal(buildMarkFailedMock.mock.calls[0].arguments[0], "order_1");
});
