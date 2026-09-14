import test from "node:test";
import assert from "node:assert/strict";

import { createProductSchema, updateProductSchema } from "@/modules/products/schemas/product.schema.ts";

const validBase = {
  name: "Laptop Pro",
  slug: "laptop-pro",
  sku: "lap-001",
  priceCents: 100000,
  categoryId: "550e8400-e29b-41d4-a716-446655440000",
};

test("createProductSchema accepts a minimal valid product", () => {
  const result = createProductSchema.safeParse(validBase);
  assert.equal(result.success, true);
});

test("createProductSchema defaults stock to 0 and isActive to true when omitted", () => {
  const result = createProductSchema.parse(validBase);
  assert.equal(result.stock, 0);
  assert.equal(result.isActive, true);
});

test("createProductSchema uppercases the SKU", () => {
  const result = createProductSchema.parse(validBase);
  assert.equal(result.sku, "LAP-001");
});

test("createProductSchema rejects an empty name", () => {
  const result = createProductSchema.safeParse({ ...validBase, name: "" });
  assert.equal(result.success, false);
});

test("createProductSchema rejects a name over 140 characters", () => {
  const result = createProductSchema.safeParse({ ...validBase, name: "a".repeat(141) });
  assert.equal(result.success, false);
});

test("createProductSchema rejects a slug with uppercase or spaces", () => {
  assert.equal(createProductSchema.safeParse({ ...validBase, slug: "Laptop Pro" }).success, false);
});

test("createProductSchema accepts a slug with numbers and multiple hyphens", () => {
  assert.equal(
    createProductSchema.safeParse({ ...validBase, slug: "laptop-pro-2026" }).success,
    true,
  );
});

test("createProductSchema rejects a negative price", () => {
  assert.equal(createProductSchema.safeParse({ ...validBase, priceCents: -1 }).success, false);
});

test("createProductSchema rejects a non-integer price", () => {
  assert.equal(createProductSchema.safeParse({ ...validBase, priceCents: 10.5 }).success, false);
});

test("createProductSchema rejects a price above the int4 limit", () => {
  assert.equal(
    createProductSchema.safeParse({ ...validBase, priceCents: 2_147_483_648 }).success,
    false,
  );
});

test("createProductSchema accepts a price at exactly the int4 limit", () => {
  assert.equal(
    createProductSchema.safeParse({ ...validBase, priceCents: 2_147_483_647 }).success,
    true,
  );
});

test("createProductSchema rejects negative stock", () => {
  assert.equal(createProductSchema.safeParse({ ...validBase, stock: -1 }).success, false);
});

test("createProductSchema rejects an invalid categoryId", () => {
  assert.equal(
    createProductSchema.safeParse({ ...validBase, categoryId: "not-a-uuid" }).success,
    false,
  );
});

test("createProductSchema normalizes an empty imageUrl to null", () => {
  const result = createProductSchema.parse({ ...validBase, imageUrl: "" });
  assert.equal(result.imageUrl, null);
});

test("createProductSchema defaults a missing imageUrl to null", () => {
  const result = createProductSchema.parse(validBase);
  assert.equal(result.imageUrl, null);
});

test("createProductSchema accepts a valid imageUrl", () => {
  const result = createProductSchema.parse({
    ...validBase,
    imageUrl: "https://images.unsplash.com/photo-1",
  });
  assert.equal(result.imageUrl, "https://images.unsplash.com/photo-1");
});

test("createProductSchema rejects a malformed imageUrl", () => {
  assert.equal(
    createProductSchema.safeParse({ ...validBase, imageUrl: "not-a-url" }).success,
    false,
  );
});

test("updateProductSchema rejects an empty patch", () => {
  const result = updateProductSchema.safeParse({});
  assert.equal(result.success, false);
});

test("updateProductSchema accepts a single-field patch", () => {
  const result = updateProductSchema.safeParse({ name: "Nuevo nombre" });
  assert.equal(result.success, true);
});

test("updateProductSchema uppercases the SKU when it's part of the patch", () => {
  const result = updateProductSchema.parse({ sku: "new-sku" });
  assert.equal(result.sku, "NEW-SKU");
});

test("updateProductSchema still validates the fields it does receive", () => {
  const result = updateProductSchema.safeParse({ priceCents: -5 });
  assert.equal(result.success, false);
});
