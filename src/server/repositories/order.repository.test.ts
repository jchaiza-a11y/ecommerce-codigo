import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const runBatchMock = mock.fn(async (_statements: unknown[]) => {});
mock.module("@/server/db/batch", {
  exports: { runBatch: runBatchMock },
});

const {
  createWithItems,
  findByStripeCheckoutSessionId,
  findWithItems,
  findByIdAndUserId,
  findHistoryByUserId,
  buildMarkPaid,
  buildMarkFailed,
} = await import("@/server/repositories/order.repository.ts");

test.beforeEach(() => {
  db.resetCalls();
  runBatchMock.mock.resetCalls();
});

test("createWithItems() batches exactly the header insert and the items insert", async () => {
  await createWithItems(
    { id: "order_1", userId: "user_1", totalCents: 1000, status: "pending" } as never,
    [{ productId: "prod_1", quantity: 2 } as never],
  );

  assert.equal(runBatchMock.mock.calls.length, 1);
  assert.equal((runBatchMock.mock.calls[0].arguments[0] as unknown[]).length, 2);
});

test("createWithItems() stamps every item with the order id", async () => {
  await createWithItems(
    { id: "order_1", userId: "user_1", totalCents: 1000, status: "pending" } as never,
    [
      { productId: "prod_1", quantity: 2 } as never,
      { productId: "prod_2", quantity: 1 } as never,
    ],
  );

  const valuesCalls = db.calls.filter((call) => call.method === "values");
  const itemsValues = valuesCalls[1]?.args[0] as Array<{ orderId: string }>;

  assert.equal(itemsValues.length, 2);
  assert.ok(itemsValues.every((item) => item.orderId === "order_1"));
});

test("findByStripeCheckoutSessionId() returns undefined when there is no match", async () => {
  db.set([]);
  assert.equal(await findByStripeCheckoutSessionId("cs_missing"), undefined);
});

test("findByStripeCheckoutSessionId() returns the matching order", async () => {
  db.set([{ id: "order_1", stripeCheckoutSessionId: "cs_1" }]);
  assert.deepEqual(await findByStripeCheckoutSessionId("cs_1"), {
    id: "order_1",
    stripeCheckoutSessionId: "cs_1",
  });
});

test("findWithItems() returns undefined when the order has no rows", async () => {
  db.set([]);
  assert.equal(await findWithItems("order_1"), undefined);
});

test("findWithItems() folds the joined rows into one order with its items", async () => {
  db.set([
    { order: { id: "order_1", status: "paid" }, item: { id: "item_1", productName: "Mouse" } },
    { order: { id: "order_1", status: "paid" }, item: { id: "item_2", productName: "Teclado" } },
  ]);

  assert.deepEqual(await findWithItems("order_1"), {
    id: "order_1",
    status: "paid",
    items: [
      { id: "item_1", productName: "Mouse" },
      { id: "item_2", productName: "Teclado" },
    ],
  });
});

test("findByIdAndUserId() returns undefined when the order belongs to someone else", async () => {
  db.set([]);
  assert.equal(await findByIdAndUserId("order_1", "user_2"), undefined);
});

test("findHistoryByUserId() groups multiple item rows under one order", async () => {
  db.set([
    { order: { id: "order_1" }, item: { id: "item_1" } },
    { order: { id: "order_1" }, item: { id: "item_2" } },
  ]);

  assert.deepEqual(
    await findHistoryByUserId({ userId: "user_1", from: new Date(0), to: new Date() }),
    [{ id: "order_1", items: [{ id: "item_1" }, { id: "item_2" }] }],
  );
});

test("findHistoryByUserId() keeps separate orders separate", async () => {
  db.set([
    { order: { id: "order_1" }, item: { id: "item_1" } },
    { order: { id: "order_2" }, item: { id: "item_2" } },
  ]);

  const result = await findHistoryByUserId({
    userId: "user_1",
    from: new Date(0),
    to: new Date(),
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((o) => o.id),
    ["order_1", "order_2"],
  );
});

test("findHistoryByUserId() returns [] when there is nothing in range", async () => {
  db.set([]);
  assert.deepEqual(
    await findHistoryByUserId({ userId: "user_1", from: new Date(0), to: new Date() }),
    [],
  );
});

test("buildMarkPaid() sets status to paid and keeps the payment intent id", () => {
  buildMarkPaid("order_1", "pi_123");
  assert.deepEqual(db.argsFor("set"), [{ status: "paid", stripePaymentIntentId: "pi_123" }]);
});

test("buildMarkFailed() sets status to failed", () => {
  buildMarkFailed("order_1", null);
  assert.deepEqual(db.argsFor("set"), [{ status: "failed", stripePaymentIntentId: null }]);
});
