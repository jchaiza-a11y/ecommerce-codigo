import test from "node:test";
import assert from "node:assert/strict";

import {
  updateProductCostSchema,
  updateSettingsSchema,
} from "@/modules/finance/schemas/finance.schema.ts";

test("updateSettingsSchema acepta una tarifa entera de cero o más", () => {
  assert.deepEqual(updateSettingsSchema.parse({ shippingCostCents: 0 }), {
    shippingCostCents: 0,
  });
  assert.deepEqual(updateSettingsSchema.parse({ shippingCostCents: 590 }), {
    shippingCostCents: 590,
  });
});

test("updateSettingsSchema rechaza una tarifa negativa (AC7)", () => {
  assert.equal(
    updateSettingsSchema.safeParse({ shippingCostCents: -1 }).success,
    false,
  );
});

test("updateSettingsSchema rechaza una tarifa con decimales (AC7)", () => {
  assert.equal(
    updateSettingsSchema.safeParse({ shippingCostCents: 12.5 }).success,
    false,
  );
});

test("updateSettingsSchema rechaza lo que no es un número", () => {
  for (const value of ["590", null, undefined, {}]) {
    assert.equal(
      updateSettingsSchema.safeParse({ shippingCostCents: value }).success,
      false,
      `aceptó ${JSON.stringify(value)}`,
    );
  }
});

test("updateProductCostSchema rechaza un costo negativo o no entero (AC7)", () => {
  assert.equal(updateProductCostSchema.safeParse({ costCents: -5 }).success, false);
  assert.equal(
    updateProductCostSchema.safeParse({ costCents: 10.01 }).success,
    false,
  );
});

test("updateProductCostSchema acepta un costo de cero: es un costo real, no ausencia de dato", () => {
  assert.deepEqual(updateProductCostSchema.parse({ costCents: 0 }), {
    costCents: 0,
  });
});

test("los dos schemas rechazan un importe por encima del rango de int4", () => {
  assert.equal(
    updateSettingsSchema.safeParse({ shippingCostCents: 2_147_483_648 }).success,
    false,
  );
  assert.equal(
    updateProductCostSchema.safeParse({ costCents: 2_147_483_648 }).success,
    false,
  );
});
