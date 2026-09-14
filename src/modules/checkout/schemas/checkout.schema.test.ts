import test from "node:test";
import assert from "node:assert/strict";

import { checkoutSessionSchema } from "@/modules/checkout/schemas/checkout.schema.ts";

const productA = "550e8400-e29b-41d4-a716-446655440000";
const productB = "660e8400-e29b-41d4-a716-446655440001";

test("accepts a single valid line", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({ items: [{ productId: productA, quantity: 1 }] }).success,
    true,
  );
});

test("rejects an empty cart", () => {
  assert.equal(checkoutSessionSchema.safeParse({ items: [] }).success, false);
});

test("rejects more than the max number of lines", () => {
  const items = Array.from({ length: 51 }, (_, i) => ({
    productId: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}`,
    quantity: 1,
  }));
  assert.equal(checkoutSessionSchema.safeParse({ items }).success, false);
});

test("accepts exactly the max number of lines", () => {
  const items = Array.from({ length: 50 }, (_, i) => ({
    productId: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}`,
    quantity: 1,
  }));
  assert.equal(checkoutSessionSchema.safeParse({ items }).success, true);
});

test("rejects a quantity of zero", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({ items: [{ productId: productA, quantity: 0 }] }).success,
    false,
  );
});

test("rejects a quantity above the per-line max", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({ items: [{ productId: productA, quantity: 100 }] }).success,
    false,
  );
});

test("accepts a quantity at exactly the per-line max", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({ items: [{ productId: productA, quantity: 99 }] }).success,
    true,
  );
});

test("rejects a duplicated productId across two lines", () => {
  const result = checkoutSessionSchema.safeParse({
    items: [
      { productId: productA, quantity: 1 },
      { productId: productA, quantity: 2 },
    ],
  });
  assert.equal(result.success, false);
});

test("accepts two lines with different products", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({
      items: [
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
      ],
    }).success,
    true,
  );
});

test("rejects a non-uuid productId", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({ items: [{ productId: "not-a-uuid", quantity: 1 }] }).success,
    false,
  );
});

test("accepts an omitted savedCardId", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({ items: [{ productId: productA, quantity: 1 }] }).success,
    true,
  );
});

test("rejects a non-uuid savedCardId", () => {
  assert.equal(
    checkoutSessionSchema.safeParse({
      items: [{ productId: productA, quantity: 1 }],
      savedCardId: "not-a-uuid",
    }).success,
    false,
  );
});
