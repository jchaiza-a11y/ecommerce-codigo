import test from "node:test";
import assert from "node:assert/strict";

import { auditLogFiltersSchema } from "@/modules/audit-logs/schemas/audit-log.schema.ts";

test("accepts an empty filter set and defaults limit to 100", () => {
  const result = auditLogFiltersSchema.parse({});
  assert.equal(result.limit, 100);
});

test("swallows an over-long entityType into undefined instead of failing", () => {
  const result = auditLogFiltersSchema.safeParse({ entityType: "a".repeat(121) });
  assert.equal(result.success, true);
  assert.equal(result.success && result.data.entityType, undefined);
});

test("rejects an invalid actorId (no .catch() fallback for this field)", () => {
  const result = auditLogFiltersSchema.safeParse({ actorId: "not-a-uuid" });
  assert.equal(result.success, false);
});

test("accepts a valid actorId", () => {
  const result = auditLogFiltersSchema.safeParse({
    actorId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.equal(result.success, true);
});

test("coerces from/to from date strings", () => {
  const result = auditLogFiltersSchema.parse({ from: "2026-01-01", to: "2026-02-01" });
  assert.ok(result.from instanceof Date);
  assert.ok(result.to instanceof Date);
});

test("coerces limit from a numeric string", () => {
  assert.equal(auditLogFiltersSchema.parse({ limit: "50" }).limit, 50);
});

test("rejects a limit below 1", () => {
  assert.equal(auditLogFiltersSchema.safeParse({ limit: 0 }).success, false);
});

test("rejects a limit above 200", () => {
  assert.equal(auditLogFiltersSchema.safeParse({ limit: 201 }).success, false);
});

test("accepts a limit of exactly 200", () => {
  assert.equal(auditLogFiltersSchema.safeParse({ limit: 200 }).success, true);
});
