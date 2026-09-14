import test from "node:test";
import assert from "node:assert/strict";

import { centsToUnits, formatPrice, unitsToCents } from "@/modules/products/constants.ts";

test("formatPrice() formats cents as es-ES/EUR currency", () => {
  assert.equal(formatPrice(129999), "1.299,99 €");
});

test("formatPrice() formats zero", () => {
  assert.equal(formatPrice(0), "0,00 €");
});

test("unitsToCents() converts decimal units to integer cents", () => {
  assert.equal(unitsToCents(1299.99), 129999);
});

test("unitsToCents() rounds safely instead of leaving floating-point noise", () => {
  // 1299.99 * 100 en punto flotante da 129998.99999999999 sin el redondeo.
  assert.equal(unitsToCents(1299.99), 129999);
});

test("unitsToCents() handles zero", () => {
  assert.equal(unitsToCents(0), 0);
});

test("centsToUnits() converts integer cents back to decimal units", () => {
  assert.equal(centsToUnits(129999), 1299.99);
});

test("centsToUnits() handles zero", () => {
  assert.equal(centsToUnits(0), 0);
});

test("unitsToCents() and centsToUnits() round-trip a whole-euro amount", () => {
  assert.equal(centsToUnits(unitsToCents(50)), 50);
});
