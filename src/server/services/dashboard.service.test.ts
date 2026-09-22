import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import type {
  DailyMetric,
  LowStockItem,
  TopProduct,
} from "@/modules/dashboard/types/dashboard.types";

let salesSummary: { salesCents: number; orders: number } = {
  salesCents: 0,
  orders: 0,
};
let dailyRows: DailyMetric[] = [];
let topProducts: TopProduct[] = [];
let lowStockRows: LowStockItem[] = [];

const calls: { method: string; args: unknown[] }[] = [];

function record<T>(method: string, result: () => T) {
  return async (...args: unknown[]): Promise<T> => {
    calls.push({ method, args });

    return result();
  };
}

mock.module("@/server/repositories/metrics.repository", {
  namedExports: {
    getSalesSummary: record("getSalesSummary", () => salesSummary),
    getDailySales: record("getDailySales", () => dailyRows),
    getTopProducts: record("getTopProducts", () => topProducts),
    findLowStockProducts: record("findLowStockProducts", () => lowStockRows),
  },
});

const { getDashboardMetrics } = await import(
  "@/server/services/dashboard.service.ts"
);

function lowStockItem(index: number): LowStockItem {
  return {
    id: `prod_${index}`,
    name: `Producto ${index}`,
    sku: `SKU-${index}`,
    stock: index,
    threshold: 5,
  };
}

function argsFor(method: string): unknown[] {
  return calls.find((call) => call.method === method)?.args ?? [];
}

test.beforeEach(() => {
  calls.length = 0;
  salesSummary = { salesCents: 0, orders: 0 };
  dailyRows = [];
  topProducts = [];
  lowStockRows = [];
});

test("builds the payload with a 30-day window ending today (UTC)", async () => {
  const metrics = await getDashboardMetrics();

  const start = new Date(metrics.rangeStart);
  const end = new Date(metrics.rangeEnd);

  // El rango arranca a medianoche UTC para que la serie diaria no parta el
  // primer día ni deje fuera el día en curso.
  assert.equal(start.toISOString().slice(11), "00:00:00.000Z");
  assert.equal(metrics.daily.length, 30);
  assert.equal(metrics.daily[0].date, start.toISOString().slice(0, 10));
  assert.equal(metrics.daily[29].date, end.toISOString().slice(0, 10));
});

test("passes the same range start to every aggregation", async () => {
  const metrics = await getDashboardMetrics();
  const start = new Date(metrics.rangeStart);

  assert.deepEqual(argsFor("getSalesSummary"), [start]);
  assert.deepEqual(argsFor("getDailySales"), [start]);
  assert.deepEqual(argsFor("getTopProducts"), [start, 10]);
  assert.equal(argsFor("findLowStockProducts").length, 1);
});

test("fills the days without sales with zeros and keeps the ones with data", async () => {
  const today = new Date().toISOString().slice(0, 10);
  dailyRows = [{ date: today, salesCents: 12_000, orders: 3 }];

  const metrics = await getDashboardMetrics();

  assert.deepEqual(metrics.daily[0], {
    date: metrics.rangeStart.slice(0, 10),
    salesCents: 0,
    orders: 0,
  });
  assert.deepEqual(metrics.daily[29], {
    date: today,
    salesCents: 12_000,
    orders: 3,
  });
});

test("computes the average ticket from the summary", async () => {
  salesSummary = { salesCents: 10_000, orders: 3 };

  const metrics = await getDashboardMetrics();

  assert.equal(metrics.summary.salesCents, 10_000);
  assert.equal(metrics.summary.orders, 3);
  assert.equal(metrics.summary.averageTicketCents, 3333);
});

test("returns an average ticket of 0 without paid orders (AC4)", async () => {
  salesSummary = { salesCents: 0, orders: 0 };

  const metrics = await getDashboardMetrics();

  assert.equal(metrics.summary.averageTicketCents, 0);
});

test("counts every low stock product but only ships the 10 most critical", async () => {
  lowStockRows = Array.from({ length: 14 }, (_, index) => lowStockItem(index));

  const metrics = await getDashboardMetrics();

  assert.equal(metrics.summary.lowStockCount, 14);
  assert.equal(metrics.lowStock.length, 10);
  assert.deepEqual(
    metrics.lowStock.map((item) => item.id),
    lowStockRows.slice(0, 10).map((item) => item.id),
  );
});

test("returns the top products as the repository ordered them", async () => {
  topProducts = [
    { productId: "prod_a", name: "A", units: 9, salesCents: 90_000 },
    { productId: "prod_b", name: "B", units: 4, salesCents: 40_000 },
  ];

  const metrics = await getDashboardMetrics();

  assert.deepEqual(metrics.topProducts, topProducts);
});
