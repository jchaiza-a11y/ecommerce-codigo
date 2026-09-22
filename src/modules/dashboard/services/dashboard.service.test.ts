import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getDashboardMetrics } = await import(
  "@/modules/dashboard/services/dashboard.service.ts"
);

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getDashboardMetrics() hits GET /api/admin/metrics", async () => {
  apiMock.on("get", async () => ({ data: { daily: [] } }));

  await getDashboardMetrics();

  assert.equal(apiMock.argsFor("get")?.[0], "/api/admin/metrics");
});

test("getDashboardMetrics() returns the response data untouched", async () => {
  const metrics = {
    rangeStart: "2026-08-17T00:00:00.000Z",
    rangeEnd: "2026-09-16T00:00:00.000Z",
    summary: {
      salesCents: 125_000,
      orders: 5,
      averageTicketCents: 25_000,
      lowStockCount: 2,
    },
    daily: [{ date: "2026-08-17", salesCents: 0, orders: 0 }],
    topProducts: [],
    lowStock: [],
  };
  apiMock.on("get", async () => ({ data: metrics }));

  assert.deepEqual(await getDashboardMetrics(), metrics);
});

test("getDashboardMetrics() sends no query params or body", async () => {
  apiMock.on("get", async () => ({ data: { daily: [] } }));

  await getDashboardMetrics();

  assert.equal(apiMock.argsFor("get")?.length, 1);
});

test("getDashboardMetrics() propagates the request error instead of swallowing it", async () => {
  apiMock.on("get", async () => {
    throw new Error("network down");
  });

  await assert.rejects(getDashboardMetrics(), /network down/);
});
