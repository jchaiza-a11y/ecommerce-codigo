import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const buildInsertMock = mock.fn((row: unknown) => ({ statement: "INSERT_STUB", row }));
mock.module("@/server/repositories/audit-log.repository", {
  namedExports: { buildInsert: buildInsertMock },
});

const runBatchMock = mock.fn(async (_statements: unknown[]) => {});
mock.module("@/server/db/batch", {
  namedExports: { runBatch: runBatchMock },
});

const { AUDIT_ACTIONS, buildAuditLogInsert, recordAuditLog, getRequestAuditContext } =
  await import("@/lib/audit.ts");

test.beforeEach(() => {
  buildInsertMock.mock.resetCalls();
  runBatchMock.mock.resetCalls();
});

test("buildAuditLogInsert() defaults entityId to null and severity to info", () => {
  buildAuditLogInsert({
    actorId: "user_1",
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: "user",
  });

  const row = buildInsertMock.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.equal(row.entityId, null);
  assert.equal(row.severity, "info");
});

test("buildAuditLogInsert() keeps an explicit severity", () => {
  buildAuditLogInsert({
    actorId: null,
    action: AUDIT_ACTIONS.ORDER_PAYMENT_FAILED,
    entityType: "order",
    severity: "error",
  });

  const row = buildInsertMock.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.equal(row.severity, "error");
});

test("buildAuditLogInsert() redacts sensitive keys in metadata", () => {
  buildAuditLogInsert({
    actorId: "user_1",
    action: AUDIT_ACTIONS.USER_UPDATED,
    entityType: "user",
    metadata: { reason: "manual fix", password: "hunter2", apiKey: "sk_live_x" },
  });

  const row = buildInsertMock.mock.calls[0].arguments[0] as {
    metadata: Record<string, unknown>;
  };
  assert.equal(row.metadata.reason, "manual fix");
  assert.equal(row.metadata.password, "[redactado]");
  assert.equal(row.metadata.apiKey, "[redactado]");
});

test("buildAuditLogInsert() redacts sensitive keys inside changes.before/after", () => {
  buildAuditLogInsert({
    actorId: "user_1",
    action: AUDIT_ACTIONS.USER_UPDATED,
    entityType: "user",
    changes: {
      before: { email: "old@example.com", token: "abc" },
      after: { email: "new@example.com", token: "def" },
    },
  });

  const row = buildInsertMock.mock.calls[0].arguments[0] as {
    changes: { before: Record<string, unknown>; after: Record<string, unknown> };
  };
  assert.equal(row.changes.before.email, "old@example.com");
  assert.equal(row.changes.before.token, "[redactado]");
  assert.equal(row.changes.after.token, "[redactado]");
});

test("buildAuditLogInsert() keeps changes as null when none are given", () => {
  buildAuditLogInsert({
    actorId: "user_1",
    action: AUDIT_ACTIONS.USER_SYNCED,
    entityType: "user",
  });

  const row = buildInsertMock.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.equal(row.changes, null);
});

test("recordAuditLog() runs a batch with exactly the built insert statement", async () => {
  await recordAuditLog({
    actorId: null,
    action: AUDIT_ACTIONS.USER_AUTO_PROVISIONED,
    entityType: "user",
  });

  assert.equal(runBatchMock.mock.calls.length, 1);
  const statements = runBatchMock.mock.calls[0].arguments[0] as unknown[];
  assert.equal(statements.length, 1);
  assert.equal(buildInsertMock.mock.calls.length, 1);
});

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/x", { headers });
}

test("getRequestAuditContext() takes the first IP from x-forwarded-for", () => {
  const context = getRequestAuditContext(
    requestWithHeaders({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" }),
  );
  assert.equal(context.ipAddress, "203.0.113.5");
});

test("getRequestAuditContext() falls back to x-real-ip when there is no x-forwarded-for", () => {
  const context = getRequestAuditContext(
    requestWithHeaders({ "x-real-ip": "203.0.113.9" }),
  );
  assert.equal(context.ipAddress, "203.0.113.9");
});

test("getRequestAuditContext() accepts a valid IPv6 address", () => {
  const context = getRequestAuditContext(
    requestWithHeaders({ "x-forwarded-for": "2001:db8::1" }),
  );
  assert.equal(context.ipAddress, "2001:db8::1");
});

test("getRequestAuditContext() rejects an IPv4 with an out-of-range octet", () => {
  const context = getRequestAuditContext(
    requestWithHeaders({ "x-forwarded-for": "999.1.1.1" }),
  );
  assert.equal(context.ipAddress, null);
});

test("getRequestAuditContext() rejects a non-IP value", () => {
  const context = getRequestAuditContext(
    requestWithHeaders({ "x-forwarded-for": "not-an-ip" }),
  );
  assert.equal(context.ipAddress, null);
});

test("getRequestAuditContext() returns null ipAddress and userAgent when no headers are present", () => {
  const context = getRequestAuditContext(requestWithHeaders({}));
  assert.equal(context.ipAddress, null);
  assert.equal(context.userAgent, null);
});

test("getRequestAuditContext() passes through the user-agent header", () => {
  const context = getRequestAuditContext(
    requestWithHeaders({ "user-agent": "Mozilla/5.0 test" }),
  );
  assert.equal(context.userAgent, "Mozilla/5.0 test");
});
