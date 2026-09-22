import test from "node:test";
import assert from "node:assert/strict";

import {
  getStockStatus,
  isBelowThreshold,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_VARIANTS,
  inventoryKeys,
} from "@/modules/inventory/constants.ts";

test("getStockStatus() marks zero stock as out of stock", () => {
  assert.equal(getStockStatus(0, 5), "out_of_stock");
});

test("getStockStatus() marks stock below the threshold as low", () => {
  assert.equal(getStockStatus(3, 5), "low");
});

test("getStockStatus() treats the threshold itself as low (inclusive bound)", () => {
  assert.equal(getStockStatus(5, 5), "low");
});

test("getStockStatus() marks one unit above the threshold as ok", () => {
  assert.equal(getStockStatus(6, 5), "ok");
});

test("getStockStatus() with threshold 0 only alerts when stock runs out", () => {
  assert.equal(getStockStatus(0, 0), "out_of_stock");
  assert.equal(getStockStatus(1, 0), "ok");
});

test("getStockStatus() treats a negative stock as out of stock", () => {
  // La base lo impide con `products_stock_non_negative`, pero la función no
  // debe devolver "ok" si alguna vez llega un valor imposible.
  assert.equal(getStockStatus(-1, 5), "out_of_stock");
});

test("isBelowThreshold() covers both alert states and excludes ok", () => {
  assert.equal(isBelowThreshold(0, 5), true);
  assert.equal(isBelowThreshold(5, 5), true);
  assert.equal(isBelowThreshold(6, 5), false);
});

test("every stock status has a label and a badge variant", () => {
  for (const status of ["out_of_stock", "low", "ok"] as const) {
    assert.equal(typeof STOCK_STATUS_LABELS[status], "string");
    assert.equal(typeof STOCK_STATUS_VARIANTS[status], "string");
  }
});

test("inventoryKeys.lists() extends the module root key", () => {
  assert.deepEqual(inventoryKeys.lists(), ["inventory", "list"]);
});
