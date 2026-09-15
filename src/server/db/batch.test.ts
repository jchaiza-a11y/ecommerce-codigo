import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const batchMock = mock.fn(async (_statements: unknown[]) => {});
mock.module("@/server/db", {
  namedExports: { db: { batch: batchMock } },
});

const { runBatch } = await import("@/server/db/batch.ts");

test.beforeEach(() => {
  batchMock.mock.resetCalls();
});

test("runBatch() does nothing and never calls db.batch for an empty array", async () => {
  await runBatch([]);
  assert.equal(batchMock.mock.calls.length, 0);
});

test("runBatch() forwards a single statement to db.batch", async () => {
  const statement = { kind: "insert" };
  await runBatch([statement as never]);

  assert.equal(batchMock.mock.calls.length, 1);
  assert.deepEqual(batchMock.mock.calls[0].arguments[0], [statement]);
});

test("runBatch() forwards multiple statements in order", async () => {
  const first = { kind: "delete" };
  const second = { kind: "insert" };
  await runBatch([first as never, second as never]);

  assert.deepEqual(batchMock.mock.calls[0].arguments[0], [first, second]);
});
