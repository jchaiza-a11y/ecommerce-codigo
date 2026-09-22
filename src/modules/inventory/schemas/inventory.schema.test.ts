import test from "node:test";
import assert from "node:assert/strict";

import {
  adjustStockSchema,
  updateThresholdSchema,
} from "@/modules/inventory/schemas/inventory.schema.ts";

test("adjustStockSchema accepts a positive integer quantity", () => {
  assert.deepEqual(adjustStockSchema.parse({ quantity: 10 }), { quantity: 10 });
});

test("adjustStockSchema accepts the smallest useful quantity", () => {
  assert.equal(adjustStockSchema.safeParse({ quantity: 1 }).success, true);
});

test("adjustStockSchema rejects 0: reposition adds, it never leaves stock untouched", () => {
  assert.equal(adjustStockSchema.safeParse({ quantity: 0 }).success, false);
});

test("adjustStockSchema rejects a negative quantity: this endpoint never subtracts", () => {
  assert.equal(adjustStockSchema.safeParse({ quantity: -5 }).success, false);
});

test("adjustStockSchema rejects a decimal quantity", () => {
  assert.equal(adjustStockSchema.safeParse({ quantity: 2.5 }).success, false);
});

test("adjustStockSchema rejects a quantity above the 100 000 cap", () => {
  assert.equal(adjustStockSchema.safeParse({ quantity: 100_001 }).success, false);
});

test("adjustStockSchema accepts exactly the cap", () => {
  assert.equal(adjustStockSchema.safeParse({ quantity: 100_000 }).success, true);
});

test("adjustStockSchema rejects a missing or empty quantity", () => {
  assert.equal(adjustStockSchema.safeParse({}).success, false);
  assert.equal(adjustStockSchema.safeParse({ quantity: "" }).success, false);
});

test("adjustStockSchema rejects a numeric string: the endpoint takes JSON numbers", () => {
  assert.equal(adjustStockSchema.safeParse({ quantity: "10" }).success, false);
});

test("updateThresholdSchema accepts 0 — alert only when the product runs out", () => {
  assert.deepEqual(updateThresholdSchema.parse({ threshold: 0 }), {
    threshold: 0,
  });
});

test("updateThresholdSchema accepts a positive integer threshold", () => {
  assert.equal(updateThresholdSchema.safeParse({ threshold: 12 }).success, true);
});

test("updateThresholdSchema rejects a negative threshold", () => {
  assert.equal(updateThresholdSchema.safeParse({ threshold: -1 }).success, false);
});

test("updateThresholdSchema rejects a decimal threshold", () => {
  assert.equal(updateThresholdSchema.safeParse({ threshold: 1.5 }).success, false);
});

test("updateThresholdSchema rejects a threshold above the 100 000 cap", () => {
  assert.equal(
    updateThresholdSchema.safeParse({ threshold: 100_001 }).success,
    false,
  );
});

test("updateThresholdSchema rejects a missing threshold", () => {
  assert.equal(updateThresholdSchema.safeParse({}).success, false);
});

test("both schemas report the offending field in their issues", () => {
  const stock = adjustStockSchema.safeParse({ quantity: 0 });
  const threshold = updateThresholdSchema.safeParse({ threshold: -1 });

  assert.equal(stock.success, false);
  assert.deepEqual(stock.error?.issues[0]?.path, ["quantity"]);
  assert.equal(threshold.success, false);
  assert.deepEqual(threshold.error?.issues[0]?.path, ["threshold"]);
});
