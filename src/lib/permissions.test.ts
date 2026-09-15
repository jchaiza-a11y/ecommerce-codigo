import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { buildCurrentUser } from "@/testing/helpers/user.fixture.ts";
import type { CurrentUser } from "@/lib/auth";

let mockedUser: CurrentUser | null = null;
mock.module("@/lib/auth", {
  namedExports: { getCurrentUser: async () => mockedUser },
});

const {
  can,
  requirePermission,
  requirePermissionInPage,
  FORBIDDEN_MESSAGE,
} = await import("@/lib/permissions.ts");

test("can() returns true for an active user with the permission", () => {
  const user = buildCurrentUser({ permissions: ["products.view"] });
  assert.equal(can("products.view", user), true);
});

test("can() returns false for an active user without the permission", () => {
  const user = buildCurrentUser({ permissions: ["categories.view"] });
  assert.equal(can("products.view", user), false);
});

test("can() returns false for an inactive user even with the permission", () => {
  const user = buildCurrentUser({
    isActive: false,
    permissions: ["products.view"],
  });
  assert.equal(can("products.view", user), false);
});

test("can() returns false for a null user", () => {
  assert.equal(can("products.view", null), false);
});

test("requirePermission() returns ok:true with the user when allowed", async () => {
  mockedUser = buildCurrentUser({ permissions: ["products.view"] });

  const result = await requirePermission("products.view");

  assert.equal(result.ok, true);
  assert.ok(result.ok && result.user.id === mockedUser.id);
});

test("requirePermission() returns 401 when there is no current user", async () => {
  mockedUser = null;

  const result = await requirePermission("products.view");

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.response.status === 401);
});

test("requirePermission() returns 403 with the forbidden message for an active user missing the permission", async () => {
  mockedUser = buildCurrentUser({ permissions: [] });

  const result = await requirePermission("products.view");

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.response.status === 403);
  const body = !result.ok && (await result.response.json());
  assert.equal(body.error, FORBIDDEN_MESSAGE);
});

test("requirePermission() returns 403 with the inactive message for a deactivated user", async () => {
  mockedUser = buildCurrentUser({ isActive: false, permissions: ["products.view"] });

  const result = await requirePermission("products.view");

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.response.status === 403);
  const body = !result.ok && (await result.response.json());
  assert.notEqual(body.error, FORBIDDEN_MESSAGE);
});

test("requirePermissionInPage() returns the user when allowed", async () => {
  mockedUser = buildCurrentUser({ permissions: ["products.view"] });

  const user = await requirePermissionInPage("products.view");

  assert.equal(user.id, mockedUser.id);
});

test("requirePermissionInPage() redirects to /sign-in when there is no current user", async () => {
  mockedUser = null;

  await assert.rejects(
    () => requirePermissionInPage("products.view"),
    /NEXT_REDIRECT:\/sign-in/,
  );
});

test("requirePermissionInPage() redirects to /admin/forbidden when the user lacks the permission", async () => {
  mockedUser = buildCurrentUser({ permissions: [] });

  await assert.rejects(
    () => requirePermissionInPage("products.view"),
    /NEXT_REDIRECT:\/admin\/forbidden/,
  );
});
