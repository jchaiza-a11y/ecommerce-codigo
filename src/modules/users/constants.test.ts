import test from "node:test";
import assert from "node:assert/strict";

import { formatDate, getFullName } from "@/modules/users/constants.ts";

test("formatDate() formats a UTC instant as DD/MM/YYYY", () => {
  // Mediodía UTC evita que el timezone local corra la fecha al día anterior.
  assert.equal(formatDate("2026-03-05T12:00:00.000Z"), "05/03/2026");
});

test("formatDate() formats a local Date object", () => {
  assert.equal(formatDate(new Date(2026, 2, 5)), "05/03/2026");
});

test("getFullName() joins first and last name", () => {
  assert.equal(getFullName({ firstName: "Ana", lastName: "Pérez" }), "Ana Pérez");
});

test("getFullName() uses only the first name when the last name is missing", () => {
  assert.equal(getFullName({ firstName: "Ana", lastName: null }), "Ana");
});

test("getFullName() uses only the last name when the first name is missing", () => {
  assert.equal(getFullName({ firstName: null, lastName: "Pérez" }), "Pérez");
});

test("getFullName() falls back when both names are missing", () => {
  assert.equal(getFullName({ firstName: null, lastName: null }), "Sin nombre");
});
