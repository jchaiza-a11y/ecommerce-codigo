import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const {
  getViolatedConstraint,
  SLUG_CONSTRAINT,
  SKU_CONSTRAINT,
  findAll,
  findPublic,
  countPublic,
  findPublicBrands,
  findPublicBySlug,
  findSimilar,
  findById,
  create,
  update,
  remove,
  buildStockDecrement,
} = await import("@/server/repositories/product.repository.ts");

test.beforeEach(() => {
  db.resetCalls();
});

test("getViolatedConstraint() identifies the slug constraint", () => {
  assert.equal(
    getViolatedConstraint({ code: "23505", constraint: SLUG_CONSTRAINT }),
    SLUG_CONSTRAINT,
  );
});

test("getViolatedConstraint() identifies the sku constraint", () => {
  assert.equal(
    getViolatedConstraint({ code: "23505", constraint: SKU_CONSTRAINT }),
    SKU_CONSTRAINT,
  );
});

test("getViolatedConstraint() returns undefined when there is no pg error info", () => {
  assert.equal(getViolatedConstraint(new Error("boom")), undefined);
});

test("findAll() flattens the product and its category name", async () => {
  db.set([{ product: { id: "prod_1", name: "Laptop" }, categoryName: "Laptops" }]);

  assert.deepEqual(await findAll(), [
    { id: "prod_1", name: "Laptop", categoryName: "Laptops" },
  ]);
});

test("findPublic() defaults to page 1 / 12 per page (offset 0, limit 12)", async () => {
  db.set([]);
  await findPublic({});

  assert.deepEqual(db.argsFor("limit"), [12]);
  assert.deepEqual(db.argsFor("offset"), [0]);
});

test("findPublic() computes the offset from an explicit page and perPage", async () => {
  db.set([]);
  await findPublic({ page: 3, perPage: 20 });

  assert.deepEqual(db.argsFor("limit"), [20]);
  assert.deepEqual(db.argsFor("offset"), [40]);
});

test("findPublic() flattens the product row with its category slug/name", async () => {
  db.set([
    {
      product: { id: "prod_1", name: "Laptop" },
      categorySlug: "laptops",
      categoryName: "Laptops",
    },
  ]);

  assert.deepEqual(await findPublic({}), [
    { id: "prod_1", name: "Laptop", categorySlug: "laptops", categoryName: "Laptops" },
  ]);
});

test("countPublic() returns the aggregated total", async () => {
  db.set([{ total: 7 }]);
  assert.equal(await countPublic({}), 7);
});

test("countPublic() returns 0 when the query yields no row", async () => {
  db.set([]);
  assert.equal(await countPublic({}), 0);
});

test("findPublicBrands() drops null brands from the result", async () => {
  db.set([{ brand: "Acme" }, { brand: null }, { brand: "Globex" }]);
  assert.deepEqual(await findPublicBrands(), ["Acme", "Globex"]);
});

test("findPublicBrands() returns [] when there are no brands", async () => {
  db.set([]);
  assert.deepEqual(await findPublicBrands(), []);
});

test("findPublicBySlug() returns undefined when nothing matches", async () => {
  db.set([]);
  assert.equal(await findPublicBySlug("missing"), undefined);
});

test("findPublicBySlug() flattens the matching row", async () => {
  db.set([
    { product: { id: "prod_1" }, categorySlug: "laptops", categoryName: "Laptops" },
  ]);

  assert.deepEqual(await findPublicBySlug("laptop-1"), {
    id: "prod_1",
    categorySlug: "laptops",
    categoryName: "Laptops",
  });
});

test("findSimilar() defaults to a limit of 4", async () => {
  db.set([]);
  await findSimilar({
    id: "prod_1",
    categoryId: "cat_1",
    brand: null,
    priceCents: 1000,
  } as never);

  assert.deepEqual(db.argsFor("limit"), [4]);
});

test("findSimilar() accepts an explicit limit", async () => {
  db.set([]);
  await findSimilar(
    { id: "prod_1", categoryId: "cat_1", brand: null, priceCents: 1000 } as never,
    2,
  );

  assert.deepEqual(db.argsFor("limit"), [2]);
});

test("findSimilar() adds a brand-priority clause only when the reference product has a brand", async () => {
  db.set([]);
  await findSimilar(
    { id: "prod_1", categoryId: "cat_1", brand: null, priceCents: 1000 } as never,
  );
  const withoutBrand = (db.argsFor("orderBy") ?? []).length;

  db.resetCalls();
  await findSimilar(
    { id: "prod_1", categoryId: "cat_1", brand: "Acme", priceCents: 1000 } as never,
  );
  const withBrand = (db.argsFor("orderBy") ?? []).length;

  assert.equal(withBrand, withoutBrand + 1);
});

test("findById() returns undefined for a soft-deleted or missing product", async () => {
  db.set([]);
  assert.equal(await findById("missing"), undefined);
});

test("create() returns the inserted row", async () => {
  db.set([{ id: "prod_1", name: "Laptop" }]);
  assert.deepEqual(await create({ name: "Laptop" } as never), { id: "prod_1", name: "Laptop" });
});

test("update() returns the updated row", async () => {
  db.set([{ id: "prod_1", name: "Laptop Pro" }]);
  assert.deepEqual(await update("prod_1", { name: "Laptop Pro" }), {
    id: "prod_1",
    name: "Laptop Pro",
  });
});

test("remove() returns undefined when the product was already gone", async () => {
  db.set([]);
  assert.equal(await remove("missing"), undefined);
});

test("buildStockDecrement() does not throw and returns a pending statement", () => {
  assert.doesNotThrow(() => buildStockDecrement("prod_1", 2, "order_1"));
});
