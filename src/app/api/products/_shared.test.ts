import test from "node:test";
import assert from "node:assert/strict";

import { SKU_CONSTRAINT, SLUG_CONSTRAINT } from "@/server/repositories/product.repository.ts";
import {
  conflictFromUniqueViolation,
  SKU_TAKEN,
  SLUG_TAKEN,
} from "@/app/api/products/_shared.ts";

async function bodyOf(response: Response) {
  return response.json() as Promise<{ error: string }>;
}

test("conflictFromUniqueViolation() reports the slug taken for the slug constraint", async () => {
  const response = conflictFromUniqueViolation({ code: "23505", constraint: SLUG_CONSTRAINT });

  assert.ok(response !== null);
  assert.equal(response.status, 409);
  assert.equal((await bodyOf(response)).error, SLUG_TAKEN);
});

test("conflictFromUniqueViolation() reports the sku taken for the sku constraint", async () => {
  const response = conflictFromUniqueViolation({ code: "23505", constraint: SKU_CONSTRAINT });

  assert.ok(response !== null);
  assert.equal((await bodyOf(response)).error, SKU_TAKEN);
});

test("conflictFromUniqueViolation() defaults to the slug message for an unrecognized constraint", async () => {
  const response = conflictFromUniqueViolation({ code: "23505", constraint: "some_other_unique" });

  assert.ok(response !== null);
  assert.equal((await bodyOf(response)).error, SLUG_TAKEN);
});

test("conflictFromUniqueViolation() returns null for a non-unique-violation pg error", () => {
  assert.equal(conflictFromUniqueViolation({ code: "23503" }), null);
});

test("conflictFromUniqueViolation() returns null for a non-pg error", () => {
  assert.equal(conflictFromUniqueViolation(new Error("boom")), null);
});
