import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getInventory, adjustStock, updateLowStockThreshold } = await import(
  "@/modules/inventory/services/inventory.service.ts"
);

const PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000";

const item = {
  id: PRODUCT_ID,
  name: "Laptop",
  sku: "LAP-001",
  categoryName: "Laptops",
  isActive: true,
  stock: 13,
  lowStockThreshold: 5,
};

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getInventory() hits GET /api/admin/inventory", async () => {
  apiMock.on("get", async () => ({ data: [] }));

  await getInventory();

  assert.equal(apiMock.argsFor("get")?.[0], "/api/admin/inventory");
});

test("getInventory() sends no query params", async () => {
  apiMock.on("get", async () => ({ data: [] }));

  await getInventory();

  assert.equal(apiMock.argsFor("get")?.length, 1);
});

test("getInventory() returns the response data untouched", async () => {
  apiMock.on("get", async () => ({ data: [item] }));

  assert.deepEqual(await getInventory(), [item]);
});

test("adjustStock() patches the stock endpoint of that product", async () => {
  apiMock.on("patch", async () => ({ data: item }));

  await adjustStock(PRODUCT_ID, { quantity: 10 });

  assert.equal(
    apiMock.argsFor("patch")?.[0],
    `/api/admin/inventory/${PRODUCT_ID}/stock`,
  );
});

test("adjustStock() sends the quantity as the increment, not the final stock", async () => {
  apiMock.on("patch", async () => ({ data: item }));

  await adjustStock(PRODUCT_ID, { quantity: 10 });

  assert.deepEqual(apiMock.argsFor("patch")?.[1], { quantity: 10 });
});

test("adjustStock() returns the refreshed row", async () => {
  apiMock.on("patch", async () => ({ data: item }));

  assert.deepEqual(await adjustStock(PRODUCT_ID, { quantity: 10 }), item);
});

test("updateLowStockThreshold() patches the threshold endpoint of that product", async () => {
  apiMock.on("patch", async () => ({ data: item }));

  await updateLowStockThreshold(PRODUCT_ID, { threshold: 3 });

  assert.equal(
    apiMock.argsFor("patch")?.[0],
    `/api/admin/inventory/${PRODUCT_ID}/threshold`,
  );
  assert.deepEqual(apiMock.argsFor("patch")?.[1], { threshold: 3 });
});

test("updateLowStockThreshold() forwards a 0 threshold instead of dropping it", async () => {
  apiMock.on("patch", async () => ({ data: { ...item, lowStockThreshold: 0 } }));

  await updateLowStockThreshold(PRODUCT_ID, { threshold: 0 });

  assert.deepEqual(apiMock.argsFor("patch")?.[1], { threshold: 0 });
});

test("the three calls propagate the request error instead of swallowing it", async () => {
  apiMock.on("get", async () => {
    throw new Error("network down");
  });
  apiMock.on("patch", async () => {
    throw new Error("network down");
  });

  await assert.rejects(getInventory(), /network down/);
  await assert.rejects(adjustStock(PRODUCT_ID, { quantity: 1 }), /network down/);
  await assert.rejects(
    updateLowStockThreshold(PRODUCT_ID, { threshold: 1 }),
    /network down/,
  );
});
