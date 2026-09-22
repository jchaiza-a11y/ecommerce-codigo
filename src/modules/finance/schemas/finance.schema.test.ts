import test from "node:test";
import assert from "node:assert/strict";

import {
  createManualExpenseSchema,
  createManualIncomeSchema,
  financeEntryIdSchema,
  updateManualExpenseSchema,
  updateManualIncomeSchema,
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

/* --- CRUD manual (016) -------------------------------------------------- */

const VALID_INCOME = {
  amountCents: 4_500,
  category: "venta_extra",
  occurredAt: "2026-09-10",
  description: "Venta en mostrador",
};

const VALID_EXPENSE = {
  amountCents: 90_000,
  category: "alquiler",
  occurredAt: "2026-09-01T10:30:00.000Z",
};

test("createManualIncomeSchema coerciona la fecha del formulario a Date", () => {
  const parsed = createManualIncomeSchema.parse(VALID_INCOME);

  assert.ok(parsed.occurredAt instanceof Date);
  assert.equal(parsed.occurredAt.toISOString(), "2026-09-10T00:00:00.000Z");
});

test("createManualExpenseSchema acepta una entrada sin descripción", () => {
  const parsed = createManualExpenseSchema.parse(VALID_EXPENSE);

  assert.equal(parsed.description, undefined);
  assert.equal(parsed.category, "alquiler");
});

test("los dos schemas de alta rechazan una categoría fuera del enum (AC6)", () => {
  assert.equal(
    createManualIncomeSchema.safeParse({ ...VALID_INCOME, category: "alquiler" })
      .success,
    false,
  );
  assert.equal(
    createManualExpenseSchema.safeParse({
      ...VALID_EXPENSE,
      category: "venta_extra",
    }).success,
    false,
  );
});

test("los dos schemas de alta rechazan un monto negativo o con decimales (AC6)", () => {
  for (const amountCents of [-1, 12.5]) {
    assert.equal(
      createManualIncomeSchema.safeParse({ ...VALID_INCOME, amountCents })
        .success,
      false,
      `aceptó ${amountCents} como ingreso`,
    );
    assert.equal(
      createManualExpenseSchema.safeParse({ ...VALID_EXPENSE, amountCents })
        .success,
      false,
      `aceptó ${amountCents} como egreso`,
    );
  }
});

test("los dos schemas de alta rechazan una fecha vacía o inválida", () => {
  // `null` y los números entran en la lista porque `z.coerce.date()` a secas
  // los convertiría al epoch en vez de rechazarlos.
  for (const occurredAt of ["", "   ", "ayer", null, 0]) {
    assert.equal(
      createManualIncomeSchema.safeParse({ ...VALID_INCOME, occurredAt })
        .success,
      false,
      `aceptó ${JSON.stringify(occurredAt)}`,
    );
  }
});

test("createManualIncomeSchema rechaza una descripción de más de 200 caracteres", () => {
  assert.equal(
    createManualIncomeSchema.safeParse({
      ...VALID_INCOME,
      description: "x".repeat(201),
    }).success,
    false,
  );
});

test("los schemas de edición admiten un subconjunto de campos", () => {
  assert.deepEqual(updateManualIncomeSchema.parse({ amountCents: 700 }), {
    amountCents: 700,
  });
  assert.deepEqual(updateManualExpenseSchema.parse({ category: "marketing" }), {
    category: "marketing",
  });
});

test("los schemas de edición rechazan un cuerpo vacío", () => {
  assert.equal(updateManualIncomeSchema.safeParse({}).success, false);
  assert.equal(updateManualExpenseSchema.safeParse({}).success, false);
});

test("los schemas de edición siguen validando los campos que sí llegan (AC6)", () => {
  assert.equal(
    updateManualExpenseSchema.safeParse({ amountCents: -3 }).success,
    false,
  );
  assert.equal(
    updateManualExpenseSchema.safeParse({ category: "inventada" }).success,
    false,
  );
});

test("financeEntryIdSchema solo acepta un uuid", () => {
  assert.equal(financeEntryIdSchema.safeParse("no-es-uuid").success, false);
  assert.equal(
    financeEntryIdSchema.safeParse("11111111-1111-4111-8111-111111111111")
      .success,
    true,
  );
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
