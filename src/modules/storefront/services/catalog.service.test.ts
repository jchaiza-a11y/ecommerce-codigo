import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getStorefrontProducts, getStorefrontCategories } = await import(
  "@/modules/storefront/services/catalog.service.ts"
);

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getStorefrontProducts() hits GET /api/storefront/products with an empty query by default", async () => {
  apiMock.on("get", async () => ({ data: { items: [], page: 1, perPage: 12, total: 0, totalPages: 0 } }));

  await getStorefrontProducts();

  assert.equal(apiMock.argsFor("get")?.[0], "/api/storefront/products");
  const options = apiMock.argsFor("get")?.[1] as { params: Record<string, unknown> };
  assert.deepEqual(options.params, {});
});

test("getStorefrontProducts() joins array filters as CSV", async () => {
  apiMock.on("get", async () => ({ data: { items: [], page: 1, perPage: 12, total: 0, totalPages: 0 } }));

  await getStorefrontProducts({ category: ["laptops", "mice"], sort: "price_asc" });

  const options = apiMock.argsFor("get")?.[1] as { params: Record<string, unknown> };
  assert.deepEqual(options.params, { category: "laptops,mice", sort: "price_asc" });
});

test("getStorefrontProducts() drops empty-string and undefined filters", async () => {
  apiMock.on("get", async () => ({ data: { items: [], page: 1, perPage: 12, total: 0, totalPages: 0 } }));

  await getStorefrontProducts({ q: "", brand: undefined, page: 2 });

  const options = apiMock.argsFor("get")?.[1] as { params: Record<string, unknown> };
  assert.deepEqual(options.params, { page: "2" });
});

test("getStorefrontProducts() drops an empty array filter", async () => {
  apiMock.on("get", async () => ({ data: { items: [], page: 1, perPage: 12, total: 0, totalPages: 0 } }));

  await getStorefrontProducts({ category: [] });

  const options = apiMock.argsFor("get")?.[1] as { params: Record<string, unknown> };
  assert.deepEqual(options.params, {});
});

test("getStorefrontCategories() hits GET /api/storefront/categories", async () => {
  apiMock.on("get", async () => ({ data: [{ id: "cat_1" }] }));

  assert.deepEqual(await getStorefrontCategories(), [{ id: "cat_1" }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/storefront/categories");
});
