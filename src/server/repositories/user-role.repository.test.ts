import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const { findByUserId, buildReplaceForUser, buildInsertForUser } = await import(
  "@/server/repositories/user-role.repository.ts"
);

test("findByUserId() returns whatever rows the query resolves to", async () => {
  db.set([{ slug: "admin", name: "Administrador" }]);
  assert.deepEqual(await findByUserId("user_1"), [{ slug: "admin", name: "Administrador" }]);
});

test("findByUserId() returns [] when the user has no roles", async () => {
  db.set([]);
  assert.deepEqual(await findByUserId("user_1"), []);
});

test("buildReplaceForUser() always includes the delete statement", () => {
  const statements = buildReplaceForUser("user_1", [], null);
  assert.equal(statements.length, 1);
});

test("buildReplaceForUser() appends an insert statement when there are roles to assign", () => {
  const statements = buildReplaceForUser("user_1", ["role_1", "role_2"], "actor_1");
  assert.equal(statements.length, 2);
});

test("buildInsertForUser() returns [] when there are no roles to assign", () => {
  assert.deepEqual(buildInsertForUser("user_1", [], null), []);
});

test("buildInsertForUser() returns a single insert statement for a non-empty role list", () => {
  const statements = buildInsertForUser("user_1", ["role_1"], "actor_1");
  assert.equal(statements.length, 1);
});
