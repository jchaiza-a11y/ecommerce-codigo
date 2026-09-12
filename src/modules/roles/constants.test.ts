import test from "node:test";
import assert from "node:assert/strict";

import { isPrivilegedRoleSlug } from "@/modules/roles/constants.ts";

test("isPrivilegedRoleSlug() is true for super_admin", () => {
  assert.equal(isPrivilegedRoleSlug("super_admin"), true);
});

test("isPrivilegedRoleSlug() is true for admin", () => {
  assert.equal(isPrivilegedRoleSlug("admin"), true);
});

test("isPrivilegedRoleSlug() is false for a non-privileged role", () => {
  assert.equal(isPrivilegedRoleSlug("manager"), false);
});

test("isPrivilegedRoleSlug() is false for an unknown slug", () => {
  assert.equal(isPrivilegedRoleSlug("not-a-role"), false);
});

test("isPrivilegedRoleSlug() is false for an empty string", () => {
  assert.equal(isPrivilegedRoleSlug(""), false);
});
