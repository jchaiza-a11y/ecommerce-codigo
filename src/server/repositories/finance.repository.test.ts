import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();

const {
  getSettings,
  buildUpdateSettings,
  summarizeCogs,
  buildIncomeInsert,
  buildCogsInsert,
  buildShippingInsert,
} = await import("@/server/repositories/finance.repository.ts");

const ORDER = { id: "order_1", totalCents: 12_000 };

test.beforeEach(() => {
  db.resetCalls();
  db.set([]);
});

test("getSettings() devuelve la fila singleton cuando existe", async () => {
  db.set([{ shippingCostCents: 550 }]);

  assert.deepEqual(await getSettings(), { shippingCostCents: 550 });
});

test("getSettings() cae al default cuando falta la fila singleton", async () => {
  db.set([]);

  assert.deepEqual(await getSettings(), { shippingCostCents: 0 });
});

test("buildUpdateSettings() hace upsert sobre el id del singleton", () => {
  buildUpdateSettings(700);

  assert.deepEqual(db.argsFor("values"), [{ id: 1, shippingCostCents: 700 }]);
  const [conflict] = db.argsFor("onConflictDoUpdate") as [
    { set: Record<string, unknown> },
  ];
  assert.deepEqual(conflict.set, { shippingCostCents: 700 });
});

test("summarizeCogs() suma costo × cantidad de cada línea costeada", () => {
  assert.deepEqual(
    summarizeCogs([
      { quantity: 2, unitPriceCents: 1_000, costCents: 400 },
      { quantity: 3, unitPriceCents: 500, costCents: 100 },
    ]),
    {
      amountCents: 1_100,
      itemsWithCost: 2,
      itemsWithoutCost: 0,
      excludedSalesCents: 0,
    },
  );
});

test("summarizeCogs() deja fuera del monto las líneas sin costo y las cuenta", () => {
  assert.deepEqual(
    summarizeCogs([
      { quantity: 2, unitPriceCents: 1_000, costCents: 400 },
      { quantity: 1, unitPriceCents: 3_000, costCents: null },
    ]),
    {
      amountCents: 800,
      itemsWithCost: 1,
      itemsWithoutCost: 1,
      excludedSalesCents: 3_000,
    },
  );
});

test("summarizeCogs() distingue un costo de cero de la ausencia de costo", () => {
  assert.deepEqual(
    summarizeCogs([{ quantity: 4, unitPriceCents: 900, costCents: 0 }]),
    {
      amountCents: 0,
      itemsWithCost: 1,
      itemsWithoutCost: 0,
      excludedSalesCents: 0,
    },
  );
});

test("summarizeCogs() de un pedido sin líneas es todo cero", () => {
  assert.deepEqual(summarizeCogs([]), {
    amountCents: 0,
    itemsWithCost: 0,
    itemsWithoutCost: 0,
    excludedSalesCents: 0,
  });
});

test("buildIncomeInsert() registra el total del pedido como ingreso de origen order", () => {
  buildIncomeInsert(ORDER);

  assert.deepEqual(db.argsFor("values"), [
    { origin: "order", amountCents: 12_000, orderId: "order_1" },
  ]);
});

test("buildCogsInsert() lleva la suma en el monto y el recuento en metadata", () => {
  buildCogsInsert(ORDER, [
    { quantity: 2, unitPriceCents: 1_000, costCents: 400 },
    { quantity: 1, unitPriceCents: 3_000, costCents: null },
  ]);

  assert.deepEqual(db.argsFor("values"), [
    {
      origin: "order_cogs",
      amountCents: 800,
      orderId: "order_1",
      metadata: {
        itemsWithCost: 1,
        itemsWithoutCost: 1,
        excludedSalesCents: 3_000,
      },
    },
  ]);
});

test("buildShippingInsert() usa la tarifa vigente recibida", () => {
  buildShippingInsert(ORDER, 550);

  assert.deepEqual(db.argsFor("values"), [
    { origin: "order_shipping", amountCents: 550, orderId: "order_1" },
  ]);
});

test("los tres inserts de ledger son idempotentes ante el reintento del webhook", () => {
  for (const build of [
    () => buildIncomeInsert(ORDER),
    () => buildCogsInsert(ORDER, []),
    () => buildShippingInsert(ORDER, 0),
  ]) {
    db.resetCalls();
    build();

    assert.ok(
      db.calls.some((call) => call.method === "onConflictDoNothing"),
      "falta onConflictDoNothing: un reintento duplicaría la fila del ledger",
    );
  }
});
