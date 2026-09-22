import test from "node:test";
import assert from "node:assert/strict";

import { estimateIgvCents, IGV_RATE } from "@/modules/finance/lib/igv.ts";

test("estimateIgvCents() desglosa el impuesto ya incluido en el precio", () => {
  // 11 800 con IGV incluido = 10 000 de base + 1 800 de impuesto.
  assert.equal(estimateIgvCents(11_800), 1_800);
});

test("estimateIgvCents() no aplica la tasa sobre el bruto", () => {
  // El error clásico sería 10 000 × 0,18 = 1 800; con el impuesto incluido son
  // 1 525 (10 000 − 10 000/1,18).
  assert.equal(estimateIgvCents(10_000), 1_525);
  assert.notEqual(estimateIgvCents(10_000), Math.round(10_000 * IGV_RATE));
});

test("estimateIgvCents() devuelve centavos enteros", () => {
  const igv = estimateIgvCents(1_999);

  assert.equal(Number.isInteger(igv), true);
  assert.equal(igv, 305);
});

test("estimateIgvCents() de un rango sin movimientos es 0 (AC4)", () => {
  assert.equal(estimateIgvCents(0), 0);
});

test("estimateIgvCents() ignora importes negativos en vez de devolver un impuesto negativo", () => {
  assert.equal(estimateIgvCents(-500), 0);
});
