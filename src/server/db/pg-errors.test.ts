import test from "node:test";
import assert from "node:assert/strict";

import {
  findPgError,
  isForeignKeyViolation,
  isUniqueViolation,
} from "@/server/db/pg-errors.ts";

test("findPgError() returns undefined for null", () => {
  assert.equal(findPgError(null), undefined);
});

test("findPgError() returns undefined for a primitive value", () => {
  assert.equal(findPgError("boom"), undefined);
});

test("findPgError() reads code and constraint from the root error", () => {
  assert.deepEqual(findPgError({ code: "23505", constraint: "products_slug_unique" }), {
    code: "23505",
    constraint: "products_slug_unique",
  });
});

test("findPgError() omits constraint when it isn't a string", () => {
  assert.deepEqual(findPgError({ code: "23505", constraint: 42 }), {
    code: "23505",
    constraint: undefined,
  });
});

test("findPgError() walks nested cause chains to find the code", () => {
  const error = { cause: { cause: { code: "23503" } } };
  assert.deepEqual(findPgError(error), { code: "23503", constraint: undefined });
});

test("findPgError() gives up past the max cause depth", () => {
  // 5 wrappers -> the code sits one level beyond MAX_CAUSE_DEPTH.
  const error = { cause: { cause: { cause: { cause: { cause: { code: "23505" } } } } } };
  assert.equal(findPgError(error), undefined);
});

test("findPgError() returns undefined when the chain ends without a code", () => {
  assert.equal(findPgError({ cause: { message: "no code here" } }), undefined);
});

test("isUniqueViolation() is true only for 23505", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation({ code: "23503" }), false);
  assert.equal(isUniqueViolation(null), false);
});

test("isForeignKeyViolation() is true for 23503 and 23001", () => {
  assert.equal(isForeignKeyViolation({ code: "23503" }), true);
  assert.equal(isForeignKeyViolation({ code: "23001" }), true);
});

test("isForeignKeyViolation() is false for other codes or no code", () => {
  assert.equal(isForeignKeyViolation({ code: "23505" }), false);
  assert.equal(isForeignKeyViolation({}), false);
});
