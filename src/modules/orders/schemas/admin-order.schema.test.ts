import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_ORDER_LIMIT,
  DEFAULT_RANGE_DAYS,
  ORDER_STATUS_VALUES,
  adminOrderFiltersSchema,
  resolveAdminOrderRange,
  toAdminOrderCustomer,
} from "@/modules/orders/schemas/admin-order.schema.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

test("accepts an empty filter set: the three filters are optional", () => {
  const result = adminOrderFiltersSchema.safeParse({});

  assert.equal(result.success, true);
  assert.deepEqual(result.success && result.data, {});
});

test("coerces from/to from ISO strings", () => {
  const result = adminOrderFiltersSchema.parse({
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
  });

  assert.ok(result.from instanceof Date);
  assert.ok(result.to instanceof Date);
});

test("rejects an inverted range", () => {
  const result = adminOrderFiltersSchema.safeParse({
    from: "2026-02-01T00:00:00.000Z",
    to: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.success, false);
  assert.equal(result.success === false && result.error.issues[0].path[0], "to");
});

test("rejects an empty range: `to` is exclusive, so from === to yields nothing", () => {
  const result = adminOrderFiltersSchema.safeParse({
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.success, false);
});

test("accepts a single open bound without the other", () => {
  assert.equal(
    adminOrderFiltersSchema.safeParse({ from: "2026-01-01T00:00:00.000Z" })
      .success,
    true,
  );
  assert.equal(
    adminOrderFiltersSchema.safeParse({ to: "2026-01-01T00:00:00.000Z" })
      .success,
    true,
  );
});

test("rejects an unknown status instead of silently ignoring it", () => {
  assert.equal(
    adminOrderFiltersSchema.safeParse({ status: "refunded" }).success,
    false,
  );
});

test("accepts every status of the order_status enum", () => {
  for (const status of ORDER_STATUS_VALUES) {
    assert.equal(adminOrderFiltersSchema.safeParse({ status }).success, true);
  }
});

test("rejects an empty customer text: a blank filter is a malformed query", () => {
  assert.equal(
    adminOrderFiltersSchema.safeParse({ customer: "   " }).success,
    false,
  );
});

test("trims the customer text", () => {
  assert.equal(
    adminOrderFiltersSchema.parse({ customer: "  ana  " }).customer,
    "ana",
  );
});

test("rejects a customer text over 120 characters", () => {
  assert.equal(
    adminOrderFiltersSchema.safeParse({ customer: "a".repeat(121) }).success,
    false,
  );
});

test("resolveAdminOrderRange() defaults to the last DEFAULT_RANGE_DAYS days", () => {
  const now = new Date("2026-04-01T12:00:00.000Z");
  const range = resolveAdminOrderRange({}, now);

  assert.equal(range.to.getTime(), now.getTime());
  assert.equal(
    range.from.getTime(),
    now.getTime() - DEFAULT_RANGE_DAYS * DAY_MS,
  );
});

test("resolveAdminOrderRange() anchors the default window on an explicit `to`", () => {
  const to = new Date("2026-03-01T00:00:00.000Z");
  const range = resolveAdminOrderRange({ to }, new Date("2026-04-01T00:00:00.000Z"));

  assert.equal(range.to.getTime(), to.getTime());
  assert.equal(range.from.getTime(), to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
});

test("resolveAdminOrderRange() keeps both bounds when both are given", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");
  const to = new Date("2026-01-15T00:00:00.000Z");
  const range = resolveAdminOrderRange({ from, to });

  assert.equal(range.from.getTime(), from.getTime());
  assert.equal(range.to.getTime(), to.getTime());
});

test("toAdminOrderCustomer() joins first and last name", () => {
  assert.deepEqual(
    toAdminOrderCustomer({
      id: "user_1",
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
    }),
    { id: "user_1", name: "Ana Pérez", email: "ana@example.com" },
  );
});

test("toAdminOrderCustomer() keeps the only name part it has", () => {
  assert.equal(
    toAdminOrderCustomer({
      id: "user_1",
      firstName: null,
      lastName: "Pérez",
      email: "ana@example.com",
    }).name,
    "Pérez",
  );
});

test("toAdminOrderCustomer() returns null when there is no name at all", () => {
  assert.equal(
    toAdminOrderCustomer({
      id: "user_1",
      firstName: null,
      lastName: null,
      email: "ana@example.com",
    }).name,
    null,
  );
});

test("ADMIN_ORDER_LIMIT is the single 500-row ceiling", () => {
  assert.equal(ADMIN_ORDER_LIMIT, 500);
});
