import test from "node:test";
import assert from "node:assert/strict";

import { toStorefrontProduct } from "@/modules/storefront/lib/to-storefront-product.ts";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_1",
    name: "Laptop",
    slug: "laptop",
    brand: "Acme",
    description: "Una laptop",
    priceCents: 8000,
    compareAtPriceCents: null,
    imageUrl: null,
    categorySlug: "laptops",
    categoryName: "Laptops",
    stock: 5,
    createdAt: new Date(),
    ...overrides,
  } as never;
}

test("maps the public fields straight through", () => {
  const result = toStorefrontProduct(baseRow());
  assert.equal(result.id, "prod_1");
  assert.equal(result.name, "Laptop");
  assert.equal(result.categorySlug, "laptops");
});

test("discountPercent is null when there is no compare-at price", () => {
  const result = toStorefrontProduct(baseRow({ compareAtPriceCents: null }));
  assert.equal(result.discountPercent, null);
  assert.equal(result.compareAtPriceCents, null);
});

test("discountPercent is null when the compare-at price doesn't beat the price", () => {
  const result = toStorefrontProduct(baseRow({ priceCents: 8000, compareAtPriceCents: 8000 }));
  assert.equal(result.discountPercent, null);
  assert.equal(result.compareAtPriceCents, null); // se enmascara también
});

test("computes and floors the discount percentage", () => {
  const result = toStorefrontProduct(baseRow({ priceCents: 8000, compareAtPriceCents: 10000 }));
  assert.equal(result.discountPercent, 20);
  assert.equal(result.compareAtPriceCents, 10000);
});

test("floors a non-round discount percentage instead of rounding", () => {
  // (100 - 99) / 100 * 100 = 1% exacto; probamos un caso que no cae redondo.
  const result = toStorefrontProduct(baseRow({ priceCents: 999, compareAtPriceCents: 1000 }));
  assert.equal(result.discountPercent, Math.floor((1 / 1000) * 100));
});

test("imageUrl null stays null", () => {
  assert.equal(toStorefrontProduct(baseRow({ imageUrl: null })).imageUrl, null);
});

test("keeps a well-formed http(s) imageUrl", () => {
  const result = toStorefrontProduct(
    baseRow({ imageUrl: "https://cdn.example.com/photo.jpg" }),
  );
  assert.equal(result.imageUrl, "https://cdn.example.com/photo.jpg");
});

test("drops an imageUrl with a non-http(s) protocol", () => {
  const result = toStorefrontProduct(baseRow({ imageUrl: "javascript:alert(1)" }));
  assert.equal(result.imageUrl, null);
});

test("drops a malformed imageUrl", () => {
  const result = toStorefrontProduct(baseRow({ imageUrl: "not a url" }));
  assert.equal(result.imageUrl, null);
});

test("inStock is true when there is stock", () => {
  assert.equal(toStorefrontProduct(baseRow({ stock: 1 })).inStock, true);
});

test("inStock is false when stock is exactly zero", () => {
  assert.equal(toStorefrontProduct(baseRow({ stock: 0 })).inStock, false);
});

test("isNew is true for a product created moments ago", () => {
  assert.equal(toStorefrontProduct(baseRow({ createdAt: new Date() })).isNew, true);
});

test("isNew is false for a product older than the new-product window", () => {
  const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  assert.equal(toStorefrontProduct(baseRow({ createdAt: old })).isNew, false);
});
