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

type FakeLine = { productId: string; quantity: number; unitPriceCents: number };
type FakeProduct = { stock: number; costCents: number | null };

let existingOrder: FakeOrder | undefined;
let orderDetail: (FakeOrder & { items: FakeLine[] }) | undefined;
let products: Record<string, FakeProduct> = {};
let shippingCostCents = 0;

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
    findById: async (productId: string) => products[productId],
    buildStockDecrement: buildStockDecrementMock,
  },
});

const buildIncomeInsertMock = mock.fn((order: { id: string; totalCents: number }) => ({
  kind: "income",
  orderId: order.id,
  amountCents: order.totalCents,
}));
const buildCogsInsertMock = mock.fn(
  (order: { id: string }, lines: readonly unknown[]) => ({
    kind: "cogs",
    orderId: order.id,
    lines,
  }),
);
const buildShippingInsertMock = mock.fn((order: { id: string }, amountCents: number) => ({
  kind: "shipping",
  orderId: order.id,
  amountCents,
}));

mock.module("@/server/repositories/finance.repository", {
  namedExports: {
    getSettings: async () => ({ shippingCostCents }),
    buildIncomeInsert: buildIncomeInsertMock,
    buildCogsInsert: buildCogsInsertMock,
    buildShippingInsert: buildShippingInsertMock,
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
  products = {};
  shippingCostCents = 0;
  batchedStatements = [];
  buildMarkPaidMock.mock.resetCalls();
  buildMarkFailedMock.mock.resetCalls();
  buildStockDecrementMock.mock.resetCalls();
  buildIncomeInsertMock.mock.resetCalls();
  buildCogsInsertMock.mock.resetCalls();
  buildShippingInsertMock.mock.resetCalls();
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

test("fulfillCheckout() batches one stock decrement per item plus markPaid, the three ledger rows and the audit log", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = {
    ...existingOrder,
    items: [
      { productId: "prod_1", quantity: 2, unitPriceCents: 400 },
      { productId: "prod_2", quantity: 1, unitPriceCents: 200 },
    ],
  };
  products = {
    prod_1: { stock: 10, costCents: 150 },
    prod_2: { stock: 10, costCents: 80 },
  };

  const result = await fulfillCheckout({ id: "cs_1", payment_intent: "pi_123" } as never, context);

  assert.equal(result, "fulfilled");
  // 2 decrements + markPaid + income + cogs + shipping + audit log
  assert.equal(batchedStatements.length, 7);
  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[0], "order_1");
  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[1], "pi_123");
});

test("fulfillCheckout() reads the payment intent id off an expanded object", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 1, unitPriceCents: 1000 }] };
  products = { prod_1: { stock: 10, costCents: 500 } };

  await fulfillCheckout({ id: "cs_1", payment_intent: { id: "pi_expanded" } } as never, context);

  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[1], "pi_expanded");
});

test("fulfillCheckout() resolves a missing payment intent to null", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 1, unitPriceCents: 1000 }] };
  products = { prod_1: { stock: 10, costCents: 500 } };

  await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.equal(buildMarkPaidMock.mock.calls[0].arguments[1], null);
});

test("fulfillCheckout() still fulfills an oversold line instead of blocking the payment", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 5, unitPriceCents: 200 }] };
  products = { prod_1: { stock: 1, costCents: 100 } }; // solo queda 1, se pidieron 5

  const result = await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.equal(result, "fulfilled");
  // 1 decrement + markPaid + income + cogs + shipping + audit log
  assert.equal(batchedStatements.length, 6);
});

test("fulfillCheckout() registra el total del pedido como ingreso del ledger (AC1)", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1200, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 1, unitPriceCents: 1200 }] };
  products = { prod_1: { stock: 4, costCents: 700 } };

  await fulfillCheckout({ id: "cs_1" } as never, context);

  const [order] = buildIncomeInsertMock.mock.calls[0].arguments;
  assert.equal(order.id, "order_1");
  assert.equal(order.totalCents, 1200);
});

test("fulfillCheckout() pasa al COGS el costo vigente de cada línea (AC2)", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 3000, currency: "eur" };
  orderDetail = {
    ...existingOrder,
    items: [
      { productId: "prod_1", quantity: 2, unitPriceCents: 1000 },
      { productId: "prod_2", quantity: 1, unitPriceCents: 1000 },
    ],
  };
  products = {
    prod_1: { stock: 9, costCents: 400 },
    prod_2: { stock: 9, costCents: 250 },
  };

  await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.deepEqual(buildCogsInsertMock.mock.calls[0].arguments[1], [
    { quantity: 2, unitPriceCents: 1000, costCents: 400 },
    { quantity: 1, unitPriceCents: 1000, costCents: 250 },
  ]);
});

test("fulfillCheckout() manda la línea sin costo como null, no como cero: no infla el COGS (AC2)", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 4000, currency: "eur" };
  orderDetail = {
    ...existingOrder,
    items: [
      { productId: "prod_1", quantity: 1, unitPriceCents: 1000 },
      { productId: "prod_sin_costo", quantity: 1, unitPriceCents: 3000 },
    ],
  };
  products = {
    prod_1: { stock: 9, costCents: 400 },
    prod_sin_costo: { stock: 9, costCents: null },
  };

  await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.deepEqual(buildCogsInsertMock.mock.calls[0].arguments[1], [
    { quantity: 1, unitPriceCents: 1000, costCents: 400 },
    { quantity: 1, unitPriceCents: 3000, costCents: null },
  ]);
});

test("fulfillCheckout() trata el producto ilegible como línea sin costo, no como costo cero", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_borrado", quantity: 1, unitPriceCents: 1000 }] };
  products = {}; // producto retirado con soft delete: `findById` no lo devuelve

  await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.deepEqual(buildCogsInsertMock.mock.calls[0].arguments[1], [
    { quantity: 1, unitPriceCents: 1000, costCents: null },
  ]);
});

test("fulfillCheckout() registra el envío con la tarifa vigente de finance_settings (AC3)", async () => {
  existingOrder = { id: "order_1", status: "pending", userId: "user_1", totalCents: 1000, currency: "eur" };
  orderDetail = { ...existingOrder, items: [{ productId: "prod_1", quantity: 1, unitPriceCents: 1000 }] };
  products = { prod_1: { stock: 4, costCents: 400 } };
  shippingCostCents = 590;

  await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.equal(buildShippingInsertMock.mock.calls[0].arguments[1], 590);
});

test("fulfillCheckout() no vuelve a tocar el ledger en el reintento del webhook (AC4)", async () => {
  existingOrder = { id: "order_1", status: "paid", userId: "user_1", totalCents: 1000, currency: "eur" };

  const result = await fulfillCheckout({ id: "cs_1" } as never, context);

  assert.equal(result, "already_processed");
  assert.equal(batchedStatements.length, 0);
  assert.equal(buildIncomeInsertMock.mock.calls.length, 0);
  assert.equal(buildCogsInsertMock.mock.calls.length, 0);
  assert.equal(buildShippingInsertMock.mock.calls.length, 0);
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
