import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const { findAll, findBySlugs, findAllWithPermissions, existsUserWithRoleSlug } =
  await import("@/server/repositories/role.repository.ts");

test("findAll() returns whatever rows the query resolves to", async () => {
  db.set([{ id: "role_1", name: "Admin" }]);
  assert.deepEqual(await findAll(), [{ id: "role_1", name: "Admin" }]);
});

test("findBySlugs() returns [] without querying when given an empty list", async () => {
  db.forbid();
  assert.deepEqual(await findBySlugs([]), []);
});

test("findBySlugs() returns whatever rows the query resolves to for a non-empty list", async () => {
  db.set([{ id: "role_1", slug: "admin" }]);
  assert.deepEqual(await findBySlugs(["admin"]), [{ id: "role_1", slug: "admin" }]);
});

test("findAllWithPermissions() groups permission codes under their role", async () => {
  db.set([
    { role: { id: "role_1", name: "Admin" }, permissionCode: "products.view" },
    { role: { id: "role_1", name: "Admin" }, permissionCode: "products.create" },
    { role: { id: "role_2", name: "Support" }, permissionCode: null },
  ]);

  assert.deepEqual(await findAllWithPermissions(), [
    { id: "role_1", name: "Admin", permissionCodes: ["products.view", "products.create"] },
    { id: "role_2", name: "Support", permissionCodes: [] },
  ]);
});

test("findAllWithPermissions() returns [] when there are no roles", async () => {
  db.set([]);
  assert.deepEqual(await findAllWithPermissions(), []);
});

test("existsUserWithRoleSlug() returns true when a matching row is found", async () => {
  db.set([{ userId: "user_1" }]);
  assert.equal(await existsUserWithRoleSlug("super_admin"), true);
});

test("existsUserWithRoleSlug() returns false when nothing matches", async () => {
  db.set([]);
  assert.equal(await existsUserWithRoleSlug("super_admin"), false);
});
