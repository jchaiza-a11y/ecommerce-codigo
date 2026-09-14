import test from "node:test";
import assert from "node:assert/strict";

import { createCategorySchema, updateCategorySchema } from "@/modules/categories/schemas/category.schema.ts";

const validBase = { name: "Laptops", slug: "laptops" };

test("createCategorySchema accepts a minimal valid category", () => {
  assert.equal(createCategorySchema.safeParse(validBase).success, true);
});

test("createCategorySchema defaults isActive to true and sortOrder to 0", () => {
  const result = createCategorySchema.parse(validBase);
  assert.equal(result.isActive, true);
  assert.equal(result.sortOrder, 0);
});

test("createCategorySchema rejects an empty name", () => {
  assert.equal(createCategorySchema.safeParse({ ...validBase, name: "" }).success, false);
});

test("createCategorySchema rejects a name over 80 characters", () => {
  assert.equal(
    createCategorySchema.safeParse({ ...validBase, name: "a".repeat(81) }).success,
    false,
  );
});

test("createCategorySchema rejects a slug with invalid characters", () => {
  assert.equal(createCategorySchema.safeParse({ ...validBase, slug: "Laptops!" }).success, false);
});

test("createCategorySchema rejects a negative sortOrder", () => {
  assert.equal(
    createCategorySchema.safeParse({ ...validBase, sortOrder: -1 }).success,
    false,
  );
});

test("createCategorySchema accepts sortOrder 0 explicitly", () => {
  assert.equal(createCategorySchema.safeParse({ ...validBase, sortOrder: 0 }).success, true);
});

test("createCategorySchema rejects a description over 500 characters", () => {
  assert.equal(
    createCategorySchema.safeParse({ ...validBase, description: "a".repeat(501) }).success,
    false,
  );
});

test("createCategorySchema accepts an omitted description", () => {
  assert.equal(createCategorySchema.safeParse(validBase).success, true);
});

test("updateCategorySchema rejects an empty patch", () => {
  assert.equal(updateCategorySchema.safeParse({}).success, false);
});

test("updateCategorySchema accepts a single-field patch", () => {
  assert.equal(updateCategorySchema.safeParse({ sortOrder: 3 }).success, true);
});

test("updateCategorySchema still validates the fields it does receive", () => {
  assert.equal(updateCategorySchema.safeParse({ slug: "Not Valid" }).success, false);
});
