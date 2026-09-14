import test from "node:test";
import assert from "node:assert/strict";

import { formatOrderTime, groupOrdersByDay } from "@/modules/profile/lib/group-orders-by-day.ts";

function order(id: string, localDateTime: [number, number, number, number, number]): { id: string; createdAt: string } {
  const [year, month, day, hour, minute] = localDateTime;
  return { id, createdAt: new Date(year, month, day, hour, minute).toISOString() };
}

test("formatOrderTime() formats the time portion in es-ES", () => {
  assert.equal(formatOrderTime(new Date(2026, 0, 5, 9, 5).toISOString()), "09:05");
});

test("groupOrdersByDay() returns [] for no orders", () => {
  assert.deepEqual(groupOrdersByDay([]), []);
});

test("groupOrdersByDay() groups multiple orders from the same local day together", () => {
  const items = [order("o1", [2026, 0, 5, 9, 0]), order("o2", [2026, 0, 5, 20, 0])] as never;

  const groups = groupOrdersByDay(items);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].orders.length, 2);
  assert.equal(groups[0].key, "2026-01-05");
  assert.equal(groups[0].label, "5 de enero de 2026");
});

test("groupOrdersByDay() keeps orders from different days in separate groups", () => {
  const items = [order("o1", [2026, 0, 5, 9, 0]), order("o2", [2026, 0, 6, 9, 0])] as never;

  const groups = groupOrdersByDay(items);

  assert.equal(groups.length, 2);
});

test("groupOrdersByDay() sorts groups by day, most recent first", () => {
  const items = [order("o1", [2026, 0, 5, 9, 0]), order("o2", [2026, 0, 7, 9, 0])] as never;

  const groups = groupOrdersByDay(items);

  assert.deepEqual(groups.map((g) => g.key), ["2026-01-07", "2026-01-05"]);
});
