import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const { findAll, findActiveWithProductCount, findById, findBySlug, create, update, remove } =
  await import("@/server/repositories/category.repository.ts");

test.beforeEach(() => {
  db.resetCalls();
});

test("findAll() returns whatever rows the query resolves to", async () => {
  db.set([{ id: "cat_1", name: "Laptops" }]);
  assert.deepEqual(await findAll(), [{ id: "cat_1", name: "Laptops" }]);
});

test("findActiveWithProductCount() flattens the category and its product count", async () => {
  db.set([
    { category: { id: "cat_1", name: "Laptops" }, productCount: 3 },
    { category: { id: "cat_2", name: "Mice" }, productCount: 0 },
  ]);

  assert.deepEqual(await findActiveWithProductCount(), [
    { id: "cat_1", name: "Laptops", productCount: 3 },
    { id: "cat_2", name: "Mice", productCount: 0 },
  ]);
});

test("findById() returns undefined when not found", async () => {
  db.set([]);
  assert.equal(await findById("missing"), undefined);
});

test("findBySlug() looks up by slug alone when no id is excluded", async () => {
  db.set([{ id: "cat_1", slug: "laptops" }]);
  assert.deepEqual(await findBySlug("laptops"), { id: "cat_1", slug: "laptops" });
});

test("findBySlug() still resolves when excluding an id (edit-uniqueness check)", async () => {
  db.set([]);
  assert.equal(await findBySlug("laptops", "cat_1"), undefined);
});

test("create() returns the inserted row", async () => {
  db.set([{ id: "cat_1", name: "Laptops" }]);
  assert.deepEqual(await create({ name: "Laptops" } as never), { id: "cat_1", name: "Laptops" });
});

test("update() returns the updated row", async () => {
  db.set([{ id: "cat_1", name: "Laptops Pro" }]);
  assert.deepEqual(await update("cat_1", { name: "Laptops Pro" }), {
    id: "cat_1",
    name: "Laptops Pro",
  });
});

test("remove() returns undefined when nothing matched", async () => {
  db.set([]);
  assert.equal(await remove("missing"), undefined);
});
