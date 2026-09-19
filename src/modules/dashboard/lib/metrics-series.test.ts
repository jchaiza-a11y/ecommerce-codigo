import test from "node:test";
import assert from "node:assert/strict";

import { averageTicketCents, fillMissingDays } from "@/modules/dashboard/lib/metrics-series.ts";

const START = "2026-09-01T00:00:00.000Z";

test("fillMissingDays() pone salesCents y orders a 0 en un día sin filas (AC3)", () => {
  const series = fillMissingDays(
    [
      { date: "2026-09-01", salesCents: 10_000, orders: 2 },
      { date: "2026-09-03", salesCents: 5_000, orders: 1 },
    ],
    START,
    3,
  );

  assert.deepEqual(series, [
    { date: "2026-09-01", salesCents: 10_000, orders: 2 },
    { date: "2026-09-02", salesCents: 0, orders: 0 },
    { date: "2026-09-03", salesCents: 5_000, orders: 1 },
  ]);
});

test("fillMissingDays() devuelve exactamente `days` puntos consecutivos y ascendentes", () => {
  const series = fillMissingDays([{ date: "2026-09-15", salesCents: 1, orders: 1 }], START, 30);

  assert.equal(series.length, 30);
  assert.equal(series[0].date, "2026-09-01");
  assert.equal(series[29].date, "2026-09-30");

  const dates = series.map((point) => point.date);
  assert.deepEqual(dates, [...dates].sort(), "las fechas vienen en orden ascendente");
  assert.equal(new Set(dates).size, 30, "no hay fechas repetidas ni huecos");
});

test("fillMissingDays() cruza el cambio de mes sin saltarse días", () => {
  const series = fillMissingDays([], "2026-09-29T00:00:00.000Z", 4);

  assert.deepEqual(
    series.map((point) => point.date),
    ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"],
  );
});

test("fillMissingDays() ignora filas fuera del rango y no depende del orden de entrada", () => {
  const series = fillMissingDays(
    [
      { date: "2026-09-03", salesCents: 300, orders: 3 },
      { date: "2026-08-31", salesCents: 999, orders: 9 },
      { date: "2026-09-01", salesCents: 100, orders: 1 },
      { date: "2026-09-20", salesCents: 777, orders: 7 },
    ],
    START,
    3,
  );

  assert.deepEqual(series, [
    { date: "2026-09-01", salesCents: 100, orders: 1 },
    { date: "2026-09-02", salesCents: 0, orders: 0 },
    { date: "2026-09-03", salesCents: 300, orders: 3 },
  ]);
});

test("fillMissingDays() acepta un Date con hora y ancla el rango a su día UTC", () => {
  const series = fillMissingDays(
    [{ date: "2026-09-01", salesCents: 400, orders: 4 }],
    new Date("2026-09-01T23:45:12.000Z"),
    2,
  );

  assert.deepEqual(series, [
    { date: "2026-09-01", salesCents: 400, orders: 4 },
    { date: "2026-09-02", salesCents: 0, orders: 0 },
  ]);
});

test("fillMissingDays() normaliza filas que llegan con timestamp ISO completo", () => {
  const series = fillMissingDays(
    [{ date: "2026-09-02T00:00:00.000Z", salesCents: 250, orders: 2 }],
    START,
    2,
  );

  assert.deepEqual(series, [
    { date: "2026-09-01", salesCents: 0, orders: 0 },
    { date: "2026-09-02", salesCents: 250, orders: 2 },
  ]);
});

test("fillMissingDays() con 0 días devuelve []", () => {
  assert.deepEqual(fillMissingDays([], START, 0), []);
});

test("averageTicketCents() devuelve 0 con 0 pedidos, sin NaN ni división por cero (AC4)", () => {
  const result = averageTicketCents(0, 0);

  assert.equal(result, 0);
  assert.equal(Number.isNaN(result), false);
});

test("averageTicketCents() devuelve 0 con 0 pedidos aunque haya importe", () => {
  assert.equal(averageTicketCents(12_345, 0), 0);
});

test("averageTicketCents() redondea a un entero de centavos", () => {
  // 10.000 / 3 = 3333,33… → 3333
  assert.equal(averageTicketCents(10_000, 3), 3_333);
  // 10.000 / 6 = 1666,66… → 1667
  assert.equal(averageTicketCents(10_000, 6), 1_667);
  assert.equal(Number.isInteger(averageTicketCents(10_000, 7)), true);
});

test("averageTicketCents() divide exacto sin tocar el valor", () => {
  assert.equal(averageTicketCents(9_000, 3), 3_000);
});
