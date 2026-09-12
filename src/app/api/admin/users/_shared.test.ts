import test from "node:test";
import assert from "node:assert/strict";

import { buildCurrentUser } from "@/testing/helpers/user.fixture.ts";
import {
  checkRoleHierarchy,
  generateTemporaryPassword,
  isSuperAdmin,
} from "@/app/api/admin/users/_shared.ts";

function userWithRoles(...slugs: string[]) {
  return buildCurrentUser({ roles: slugs.map((slug) => ({ slug, name: slug })) });
}

test("isSuperAdmin() is true when the actor has the super_admin role", () => {
  assert.equal(isSuperAdmin(userWithRoles("super_admin")), true);
});

test("isSuperAdmin() is false when the actor lacks the role", () => {
  assert.equal(isSuperAdmin(userWithRoles("manager")), false);
});

test("isSuperAdmin() is false for an actor with no roles at all", () => {
  assert.equal(isSuperAdmin(userWithRoles()), false);
});

test("checkRoleHierarchy() allows a non-privileged change for any actor", () => {
  const actor = userWithRoles("manager");
  assert.equal(checkRoleHierarchy(actor, ["manager"], ["employee"]), null);
});

test("checkRoleHierarchy() allows a super_admin actor to touch privileged roles", () => {
  const actor = userWithRoles("super_admin");
  assert.equal(checkRoleHierarchy(actor, ["admin"], []), null);
});

test("checkRoleHierarchy() blocks a non super_admin actor from granting admin", async () => {
  const actor = userWithRoles("manager");
  const response = checkRoleHierarchy(actor, ["admin"], []);

  assert.ok(response !== null);
  assert.equal(response.status, 403);
});

test("checkRoleHierarchy() blocks revoking a privileged role the target already has", () => {
  const actor = userWithRoles("manager");
  const response = checkRoleHierarchy(actor, ["employee"], ["super_admin"]);

  assert.ok(response !== null);
  assert.equal(response.status, 403);
});

test("checkRoleHierarchy() defaults currentSlugs to an empty list", () => {
  const actor = userWithRoles("manager");
  assert.equal(checkRoleHierarchy(actor, ["employee"]), null);
});

test("generateTemporaryPassword() matches the expected shape", () => {
  const password = generateTemporaryPassword();
  assert.match(password, /^[0-9A-F]{4}-[0-9a-f]{8}-[0-9a-f]{4}#$/);
});

test("generateTemporaryPassword() is not the same on every call", () => {
  assert.notEqual(generateTemporaryPassword(), generateTemporaryPassword());
});
