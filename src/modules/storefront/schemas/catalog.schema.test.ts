import test from "node:test";
import assert from "node:assert/strict";

import {
  newsletterEmailSchema,
  storefrontCategorySchema,
  storefrontProductQuerySchema,
  storefrontProductSchema,
} from "@/modules/storefront/schemas/catalog.schema.ts";

test("splits a category CSV into a trimmed, non-empty array", () => {
  const result = storefrontProductQuerySchema.parse({ category: "laptops, mice ,keyboards" });
  assert.deepEqual(result.category, ["laptops", "mice", "keyboards"]);
});

test("leaves category undefined when omitted", () => {
  assert.equal(storefrontProductQuerySchema.parse({}).category, undefined);
});

test("rejects an explicitly empty category string", () => {
  assert.equal(storefrontProductQuerySchema.safeParse({ category: "" }).success, false);
});

test("rejects an unknown price range id", () => {
  assert.equal(storefrontProductQuerySchema.safeParse({ price: "not-a-range" }).success, false);
});

test("accepts a known price range id", () => {
  assert.equal(storefrontProductQuerySchema.safeParse({ price: "lt500" }).success, true);
});

test("coerces inStock from the string true", () => {
  assert.equal(storefrontProductQuerySchema.parse({ inStock: "true" }).inStock, true);
});

test("coerces inStock from the string false", () => {
  assert.equal(storefrontProductQuerySchema.parse({ inStock: "false" }).inStock, false);
});

test("inStock defaults to false when omitted (optional().transform() always runs)", () => {
  // El transform corre igual sobre `undefined`: `undefined === "true"` da
  // `false`, no `undefined`, pese al `.optional()`. Efecto idéntico donde se
  // consume (`if (filters.inStock)`), así que no es un bug real.
  assert.equal(storefrontProductQuerySchema.parse({}).inStock, false);
});

test("defaults sort to newest", () => {
  assert.equal(storefrontProductQuerySchema.parse({}).sort, "newest");
});

test("rejects an unknown sort value", () => {
  assert.equal(storefrontProductQuerySchema.safeParse({ sort: "cheapest" }).success, false);
});

test("defaults page to 1 and perPage to 12", () => {
  const result = storefrontProductQuerySchema.parse({});
  assert.equal(result.page, 1);
  assert.equal(result.perPage, 12);
});

test("coerces page and perPage from numeric strings", () => {
  const result = storefrontProductQuerySchema.parse({ page: "3", perPage: "24" });
  assert.equal(result.page, 3);
  assert.equal(result.perPage, 24);
});

test("rejects a page below 1", () => {
  assert.equal(storefrontProductQuerySchema.safeParse({ page: "0" }).success, false);
});

test("rejects a perPage above the max", () => {
  assert.equal(storefrontProductQuerySchema.safeParse({ perPage: "49" }).success, false);
});

test("accepts a perPage of exactly the max", () => {
  assert.equal(storefrontProductQuerySchema.safeParse({ perPage: "48" }).success, true);
});

const validProduct = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Laptop",
  slug: "laptop",
  brand: null,
  description: null,
  priceCents: 1000,
  compareAtPriceCents: null,
  discountPercent: null,
  imageUrl: null,
  categorySlug: "laptops",
  categoryName: "Laptops",
  inStock: true,
  isNew: false,
};

test("storefrontProductSchema accepts a well-formed public product", () => {
  assert.equal(storefrontProductSchema.safeParse(validProduct).success, true);
});

test("storefrontProductSchema rejects a product missing required fields", () => {
  assert.equal(storefrontProductSchema.safeParse({ id: validProduct.id }).success, false);
});

test("storefrontCategorySchema accepts a well-formed public category", () => {
  assert.equal(
    storefrontCategorySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Laptops",
      slug: "laptops",
      productCount: 5,
    }).success,
    true,
  );
});

test("newsletterEmailSchema accepts a valid email", () => {
  assert.equal(newsletterEmailSchema.safeParse({ email: "ana@example.com" }).success, true);
});

test("newsletterEmailSchema rejects an invalid email", () => {
  assert.equal(newsletterEmailSchema.safeParse({ email: "not-an-email" }).success, false);
});
