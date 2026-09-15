import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { mockClerkClient } from "@/testing/mocks/clerk.mock.ts";

const clerk = mockClerkClient();

let accessResult: {
  user: { id: string };
  roles: { slug: string; name: string }[];
  permissionCodes: string[];
} | undefined;

mock.module("@/server/repositories/user.repository", {
  namedExports: { findRolesAndPermissionsByClerkId: async () => accessResult },
});

const { syncClerkAccessMetadata, markPendingAccess } = await import(
  "@/server/services/user-access.service.ts"
);

test.beforeEach(() => {
  clerk.resetCalls();
});

test("syncClerkAccessMetadata() does nothing when the user isn't synced locally", async () => {
  accessResult = undefined;
  await syncClerkAccessMetadata("clerk_missing");

  assert.equal(clerk.calls.length, 0);
});

test("syncClerkAccessMetadata() pushes roles and permissions and clears pendingRoles", async () => {
  accessResult = {
    user: { id: "user_1" },
    roles: [{ slug: "admin", name: "Admin" }, { slug: "manager", name: "Manager" }],
    permissionCodes: ["products.view", "products.create"],
  };

  await syncClerkAccessMetadata("clerk_1");

  const args = clerk.argsFor("updateUserMetadata");
  assert.equal(args?.[0], "clerk_1");
  assert.deepEqual(args?.[1], {
    publicMetadata: {
      roles: ["admin", "manager"],
      permissions: ["products.view", "products.create"],
      pendingRoles: [],
    },
  });
});

test("markPendingAccess() sets pendingRoles and mustChangePassword", async () => {
  await markPendingAccess("clerk_1", ["manager", "employee"]);

  const args = clerk.argsFor("updateUserMetadata");
  assert.equal(args?.[0], "clerk_1");
  assert.deepEqual(args?.[1], {
    publicMetadata: { pendingRoles: ["manager", "employee"], mustChangePassword: true },
  });
});
