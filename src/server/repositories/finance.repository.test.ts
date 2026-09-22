import test from "node:test";
import assert from "node:assert/strict";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();

const {
  getSettings,
  buildUpdateSettings,
  summarizeCogs,
  buildIncomeInsert,
  buildCogsInsert,
  buildShippingInsert,
  getSummaryTotals,
  getDailyLedger,
  getIncomeList,
  getExpenseList,
} = await import("@/server/repositories/finance.repository.ts");

const ORDER = { id: "order_1", totalCents: 12_000 };

const RANGE_START = new Date("2026-08-23T00:00:00.000Z");
const RANGE_END = new Date("2026-09-21T12:00:00.000Z");

const dialect = new PgDialect();

/**
 * El stub de `db` no ejecuta SQL, así que los filtros y el orden solo se pueden
 * comprobar sobre los fragmentos que el repositorio le pasa a Drizzle: se
 * renderizan con el dialecto real y se mira el texto. Devuelve una entrada por
 * cada llamada al método, en el orden en que se encadenaron.
 */
function renderedCalls(method: string): { sql: string; params: unknown[] }[] {
  return db.calls
    .filter((call) => call.method === method)
    .map((call) => {
      const rendered = call.args
        .filter((arg): arg is SQL => arg !== undefined)
        .map((arg) => dialect.sqlToQuery(arg));

      return {
        sql: rendered
          .map((part) => part.sql)
          .join(" , ")
          .toLowerCase(),
        params: rendered.flatMap((part) => part.params),
      };
    });
}

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

/* --- Lecturas del panel de Finanzas (015) ------------------------------- */

test("getSummaryTotals() devuelve ceros cuando el rango no tuvo movimientos", async () => {
  db.set([]);

  assert.deepEqual(await getSummaryTotals(RANGE_START, RANGE_END), {
    incomeByOrigin: { order: 0, manual: 0 },
    expenseByOrigin: { order_cogs: 0, order_shipping: 0, manual: 0 },
    excludedSalesCents: 0,
  });
});

test("getSummaryTotals() convierte a entero la suma que el driver devuelve como texto", async () => {
  // El stub sirve las mismas filas a las tres agregaciones, así que el origen
  // del fixture es `manual`: el único válido en los dos enums a la vez.
  db.set([
    { origin: "manual", amountCents: "5000", excludedSalesCents: "2000" },
  ]);

  assert.deepEqual(await getSummaryTotals(RANGE_START, RANGE_END), {
    incomeByOrigin: { order: 0, manual: 5_000 },
    expenseByOrigin: { order_cogs: 0, order_shipping: 0, manual: 5_000 },
    excludedSalesCents: 2_000,
  });
});

test("getSummaryTotals() trata como cero la suma nula de un origen sin filas", async () => {
  db.set([{ origin: "manual", amountCents: null, excludedSalesCents: null }]);

  const totals = await getSummaryTotals(RANGE_START, RANGE_END);

  assert.equal(totals.incomeByOrigin.manual, 0);
  assert.equal(totals.excludedSalesCents, 0);
});

test("getSummaryTotals() acota las tres agregaciones al rango por occurred_at", async () => {
  db.set([]);
  await getSummaryTotals(RANGE_START, RANGE_END);

  const wheres = renderedCalls("where");

  assert.equal(wheres.length, 3);

  for (const where of wheres) {
    assert.ok(where.sql.includes('"occurred_at" >='));
    assert.ok(where.sql.includes('"occurred_at" <='));
    // El dialecto serializa el `Date` del parámetro a ISO antes de enviarlo.
    assert.ok(where.params.includes(RANGE_START.toISOString()));
    assert.ok(where.params.includes(RANGE_END.toISOString()));
  }
});

test("getSummaryTotals() agrega la cobertura solo sobre las filas order_cogs", async () => {
  db.set([]);
  await getSummaryTotals(RANGE_START, RANGE_END);

  const coverage = renderedCalls("where").at(-1);

  assert.ok(coverage?.sql.includes('"finance_expense"."origin" ='));
  assert.ok(coverage?.params.includes("order_cogs"));

  const selection = db.calls.filter((call) => call.method === "select").at(-1)
    ?.args[0] as Record<string, SQL>;

  const excluded = dialect
    .sqlToQuery(selection.excludedSalesCents)
    .sql.toLowerCase();

  // La cobertura sale de la metadata que ya guarda cada fila de COGS: no se
  // releen `order_items` ni `products` (015 §Notas).
  assert.ok(excluded.includes("->> 'excludedsalescents'"));
  assert.ok(excluded.includes("::bigint"));
});

test("getDailyLedger() agrupa las dos series por día UTC y las ordena ascendente", async () => {
  db.set([]);
  await getDailyLedger(RANGE_START, RANGE_END);

  const groupBys = renderedCalls("groupBy");
  const orderBys = renderedCalls("orderBy");

  assert.equal(groupBys.length, 2);
  assert.equal(orderBys.length, 2);

  for (const groupBy of groupBys) {
    assert.ok(groupBy.sql.includes("date_trunc('day'"));
    assert.ok(groupBy.sql.includes("at time zone 'utc'"));
  }

  for (const orderBy of orderBys) {
    assert.ok(orderBy.sql.trimEnd().endsWith("asc"));
  }
});

test("getDailyLedger() devuelve los días con movimiento ya normalizados a entero", async () => {
  db.set([
    { date: "2026-08-23", amountCents: "1000" },
    { date: "2026-08-25", amountCents: "2500" },
  ]);

  const ledger = await getDailyLedger(RANGE_START, RANGE_END);

  assert.deepEqual(ledger.income, [
    { date: "2026-08-23", amountCents: 1_000 },
    { date: "2026-08-25", amountCents: 2_500 },
  ]);
  // El relleno de los días sin movimiento es del servicio, no del repositorio.
  assert.equal(ledger.expense.length, 2);
});

test("getDailyLedger() devuelve series vacías cuando ningún día tuvo movimiento", async () => {
  db.set([]);

  assert.deepEqual(await getDailyLedger(RANGE_START, RANGE_END), {
    income: [],
    expense: [],
  });
});

test("getIncomeList() ordena por fecha descendente y respeta el límite", async () => {
  db.set([]);
  await getIncomeList({ limit: 50 });

  assert.deepEqual(db.argsFor("limit"), [50]);
  assert.ok(
    renderedCalls("orderBy")[0].sql.includes(
      '"finance_income"."occurred_at" desc',
    ),
  );
});

test("getIncomeList() sin rango no filtra por fecha", async () => {
  db.set([]);
  await getIncomeList({ limit: 100 });

  assert.deepEqual(db.argsFor("where"), [undefined]);
});

test("getIncomeList() acota por el rango recibido cuando llega", async () => {
  db.set([]);
  await getIncomeList({ from: RANGE_START, to: RANGE_END, limit: 100 });

  const where = renderedCalls("where")[0];

  assert.ok(where.sql.includes('"finance_income"."occurred_at" >='));
  assert.ok(where.sql.includes('"finance_income"."occurred_at" <='));
  assert.deepEqual(where.params, [
    RANGE_START.toISOString(),
    RANGE_END.toISOString(),
  ]);
});

test("getIncomeList() devuelve la fila tal y como la selecciona", async () => {
  const row = {
    id: "inc_1",
    origin: "order",
    amountCents: 12_000,
    description: null,
    occurredAt: RANGE_END,
    orderId: "order_1",
  };

  db.set([row]);

  assert.deepEqual(await getIncomeList({ limit: 100 }), [row]);
});

test("getExpenseList() selecciona además la categoría del egreso manual", async () => {
  db.set([]);
  await getExpenseList({ limit: 100 });

  const selection = db.argsFor("select")?.[0] as Record<string, unknown>;

  assert.ok("category" in selection);
});

test("getExpenseList() ordena por fecha descendente y respeta el límite", async () => {
  db.set([]);
  await getExpenseList({ limit: 25 });

  assert.deepEqual(db.argsFor("limit"), [25]);
  assert.ok(
    renderedCalls("orderBy")[0].sql.includes(
      '"finance_expense"."occurred_at" desc',
    ),
  );
});
