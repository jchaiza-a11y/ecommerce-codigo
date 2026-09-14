import test from "node:test";
import assert from "node:assert/strict";

import {
  confirmSetupSchema,
  savedCardIdSchema,
  setupSessionSchema,
} from "@/modules/profile/schemas/saved-card.schema.ts";

test("confirmSetupSchema accepts a well-formed cs_ session id", () => {
  assert.equal(confirmSetupSchema.safeParse({ setupSessionId: "cs_test_123" }).success, true);
});

test("confirmSetupSchema rejects an id without the cs_ prefix", () => {
  assert.equal(confirmSetupSchema.safeParse({ setupSessionId: "pm_test_123" }).success, false);
});

test("confirmSetupSchema rejects an id over 255 characters", () => {
  assert.equal(
    confirmSetupSchema.safeParse({ setupSessionId: "cs_" + "a".repeat(255) }).success,
    false,
  );
});

test("savedCardIdSchema accepts a valid uuid", () => {
  assert.equal(savedCardIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success, true);
});

test("savedCardIdSchema rejects a non-uuid string", () => {
  assert.equal(savedCardIdSchema.safeParse("not-a-uuid").success, false);
});

test("setupSessionSchema accepts an empty body", () => {
  assert.equal(setupSessionSchema.safeParse({}).success, true);
});

test("setupSessionSchema rejects any extra field", () => {
  assert.equal(setupSessionSchema.safeParse({ extra: "field" }).success, false);
});
