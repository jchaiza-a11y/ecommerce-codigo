import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

let authResult: { userId: string | null } = { userId: null };
mock.module("@clerk/nextjs/server", {
  exports: { auth: async () => authResult },
});

type RepoAccess = {
  user: {
    id: string;
    clerkId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isActive: boolean;
  };
  roles: { slug: string }[];
  permissionCodes: string[];
} | null;

let repoResult: RepoAccess = null;
mock.module("@/server/repositories/user.repository", {
  exports: { findRolesAndPermissionsByClerkId: async () => repoResult },
});

const { getCurrentUser, getCurrentUserState } = await import("@/lib/auth.ts");

test("getCurrentUserState() returns anonymous when Clerk has no session", async () => {
  authResult = { userId: null };

  const state = await getCurrentUserState();

  assert.deepEqual(state, { status: "anonymous" });
});

test("getCurrentUserState() returns unsynced when there is no local users row", async () => {
  authResult = { userId: "clerk_1" };
  repoResult = null;

  const state = await getCurrentUserState();

  assert.deepEqual(state, { status: "unsynced", clerkId: "clerk_1" });
});

test("getCurrentUserState() returns ready with the mapped user when synced", async () => {
  authResult = { userId: "clerk_1" };
  repoResult = {
    user: {
      id: "user_1",
      clerkId: "clerk_1",
      email: "ana@example.com",
      firstName: "Ana",
      lastName: null,
      isActive: true,
    },
    roles: [{ slug: "admin" }],
    permissionCodes: ["products.view"],
  };

  const state = await getCurrentUserState();

  assert.equal(state.status, "ready");
  assert.ok(state.status === "ready" && state.user.id === "user_1");
  assert.ok(state.status === "ready" && state.user.email === "ana@example.com");
  assert.deepEqual(
    state.status === "ready" ? state.user.permissions : null,
    ["products.view"],
  );
});

test("getCurrentUser() returns null when anonymous", async () => {
  authResult = { userId: null };

  assert.equal(await getCurrentUser(), null);
});

test("getCurrentUser() returns null when unsynced", async () => {
  authResult = { userId: "clerk_2" };
  repoResult = null;

  assert.equal(await getCurrentUser(), null);
});

test("getCurrentUser() returns the user when ready", async () => {
  authResult = { userId: "clerk_1" };
  repoResult = {
    user: {
      id: "user_1",
      clerkId: "clerk_1",
      email: "ana@example.com",
      firstName: "Ana",
      lastName: null,
      isActive: true,
    },
    roles: [],
    permissionCodes: [],
  };

  const user = await getCurrentUser();

  assert.ok(user !== null && user.id === "user_1");
});
