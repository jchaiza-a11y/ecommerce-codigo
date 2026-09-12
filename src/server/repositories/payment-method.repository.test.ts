import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const { listByUserId, upsertByStripeId, findByIdAndUserId, deleteById } = await import(
  "@/server/repositories/payment-method.repository.ts"
);

test.beforeEach(() => {
  db.resetCalls();
});

test("listByUserId() returns whatever rows the query resolves to", async () => {
  db.set([{ id: "pm_1", brand: "visa" }]);
  assert.deepEqual(await listByUserId("user_1"), [{ id: "pm_1", brand: "visa" }]);
});

test("upsertByStripeId() returns the saved row", async () => {
  db.set([{ id: "pm_1", brand: "visa", last4: "4242" }]);

  const saved = await upsertByStripeId({
    userId: "user_1",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
  } as never);

  assert.deepEqual(saved, { id: "pm_1", brand: "visa", last4: "4242" });
});

test("upsertByStripeId() returns undefined when the conflicting row belongs to another user", async () => {
  db.set([]);

  const saved = await upsertByStripeId({
    userId: "user_2",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
  } as never);

  assert.equal(saved, undefined);
});

test("upsertByStripeId() scopes the conflict update to the owning user", () => {
  upsertByStripeId({
    userId: "user_1",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
  } as never);

  const [config] = db.argsFor("onConflictDoUpdate") ?? [];
  assert.ok((config as { setWhere: unknown }).setWhere !== undefined);
});

test("findByIdAndUserId() returns undefined when the card belongs to someone else", async () => {
  db.set([]);
  assert.equal(await findByIdAndUserId("pm_1", "user_2"), undefined);
});

test("deleteById() resolves without throwing", async () => {
  await assert.doesNotReject(() => deleteById("pm_1"));
});
