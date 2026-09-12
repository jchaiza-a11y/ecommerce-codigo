import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const { findMany, buildInsert } = await import(
  "@/server/repositories/audit-log.repository.ts"
);

test.beforeEach(() => {
  db.resetCalls();
});

test("findMany() composes the actor name from first and last name", async () => {
  db.set([
    {
      auditLog: { id: "log_1", action: "product.created" },
      actorEmail: "ana@example.com",
      actorFirstName: "Ana",
      actorLastName: "Pérez",
    },
  ]);

  const [row] = await findMany({ limit: 50 });
  assert.equal(row.actorName, "Ana Pérez");
  assert.equal(row.actorEmail, "ana@example.com");
  assert.equal(row.id, "log_1");
});

test("findMany() uses only the first name when the last name is missing", async () => {
  db.set([
    {
      auditLog: { id: "log_1", action: "product.created" },
      actorEmail: "ana@example.com",
      actorFirstName: "Ana",
      actorLastName: null,
    },
  ]);

  const [row] = await findMany({ limit: 50 });
  assert.equal(row.actorName, "Ana");
});

test("findMany() reports a null actor name for system actions", async () => {
  db.set([
    {
      auditLog: { id: "log_1", action: "auth.login_failed" },
      actorEmail: null,
      actorFirstName: null,
      actorLastName: null,
    },
  ]);

  const [row] = await findMany({ limit: 50 });
  assert.equal(row.actorName, null);
});

test("findMany() returns [] when there are no matching rows", async () => {
  db.set([]);
  assert.deepEqual(await findMany({ limit: 50 }), []);
});

test("buildInsert() passes the values straight through to insert().values()", () => {
  const values = { action: "product.created", entityType: "product" };
  buildInsert(values as never);

  assert.deepEqual(db.argsFor("values"), [values]);
});
