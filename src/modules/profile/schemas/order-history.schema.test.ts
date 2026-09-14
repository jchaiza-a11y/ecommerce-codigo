import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_RANGE_DAYS,
  orderHistoryQuerySchema,
  RANGE_ORDER_MESSAGE,
  RANGE_SPAN_MESSAGE,
} from "@/modules/profile/schemas/order-history.schema.ts";

function isoDaysFrom(base: Date, days: number): string {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

const from = new Date("2026-01-01T00:00:00.000Z");

test("accepts a valid ascending range within the max span", () => {
  const result = orderHistoryQuerySchema.safeParse({
    from: from.toISOString(),
    to: isoDaysFrom(from, 30),
  });
  assert.equal(result.success, true);
});

test("rejects a malformed datetime string", () => {
  const result = orderHistoryQuerySchema.safeParse({ from: "2026-01-01", to: "not-a-date" });
  assert.equal(result.success, false);
});

test("rejects when to is before from", () => {
  const result = orderHistoryQuerySchema.safeParse({
    from: from.toISOString(),
    to: isoDaysFrom(from, -1),
  });
  assert.equal(result.success, false);
  assert.equal(result.success ? undefined : result.error.issues[0]?.message, RANGE_ORDER_MESSAGE);
});

test("rejects when to equals from", () => {
  const result = orderHistoryQuerySchema.safeParse({ from: from.toISOString(), to: from.toISOString() });
  assert.equal(result.success, false);
});

test("rejects a span longer than the max range", () => {
  const result = orderHistoryQuerySchema.safeParse({
    from: from.toISOString(),
    to: isoDaysFrom(from, MAX_RANGE_DAYS + 1),
  });
  assert.equal(result.success, false);
  assert.equal(result.success ? undefined : result.error.issues[0]?.message, RANGE_SPAN_MESSAGE);
});

test("accepts a span of exactly the max range", () => {
  const result = orderHistoryQuerySchema.safeParse({
    from: from.toISOString(),
    to: isoDaysFrom(from, MAX_RANGE_DAYS),
  });
  assert.equal(result.success, true);
});
