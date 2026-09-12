import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const { findAll, findByRoleIds } = await import(
  "@/server/repositories/permission.repository.ts"
);

test("findAll() returns whatever rows the query resolves to", async () => {
  db.set([{ id: "perm_1", resource: "products", action: "view" }]);
  assert.deepEqual(await findAll(), [{ id: "perm_1", resource: "products", action: "view" }]);
});

test("findByRoleIds() returns [] without querying for an empty list", async () => {
  db.forbid();
  assert.deepEqual(await findByRoleIds([]), []);
});

test("findByRoleIds() unwraps the selectDistinctOn row shape", async () => {
  db.set([
    { permission: { id: "perm_1", code: "products.view" } },
    { permission: { id: "perm_2", code: "products.create" } },
  ]);

  assert.deepEqual(await findByRoleIds(["role_1"]), [
    { id: "perm_1", code: "products.view" },
    { id: "perm_2", code: "products.create" },
  ]);
});

test("findByRoleIds() returns [] when no permission rows match", async () => {
  db.set([]);
  assert.deepEqual(await findByRoleIds(["role_1"]), []);
});
