import test from "node:test";
import assert from "node:assert/strict";

import { mockDbQuery } from "@/testing/mocks/db.mock.ts";

const db = mockDbQuery();
const {
  findById,
  findByClerkId,
  findByEmail,
  findAllWithRoles,
  findByIdWithRoles,
  findRolesAndPermissionsByClerkId,
  create,
  buildUpsertByClerkId,
  attachStripeCustomerId,
  buildUpdate,
  update,
  setActive,
  buildDeactivateByClerkId,
} = await import("@/server/repositories/user.repository.ts");

test.beforeEach(() => {
  db.resetCalls();
});

test("findById() returns the row when found", async () => {
  db.set([{ id: "user_1", email: "ana@example.com" }]);
  assert.deepEqual(await findById("user_1"), { id: "user_1", email: "ana@example.com" });
});

test("findById() returns undefined when not found", async () => {
  db.set([]);
  assert.equal(await findById("missing"), undefined);
});

test("findByClerkId() returns the row when found", async () => {
  db.set([{ id: "user_1", clerkId: "clerk_1" }]);
  assert.deepEqual(await findByClerkId("clerk_1"), { id: "user_1", clerkId: "clerk_1" });
});

test("findByEmail() returns undefined when not found", async () => {
  db.set([]);
  assert.equal(await findByEmail("nobody@example.com"), undefined);
});

test("findAllWithRoles() groups roles under their user", async () => {
  const user1 = { id: "user_1" };
  const user2 = { id: "user_2" };
  db.set([
    { user: user1, roleSlug: "admin", roleName: "Admin" },
    { user: user1, roleSlug: "manager", roleName: "Manager" },
    { user: user2, roleSlug: null, roleName: null },
  ]);

  assert.deepEqual(await findAllWithRoles(), [
    { id: "user_1", roles: [{ slug: "admin", name: "Admin" }, { slug: "manager", name: "Manager" }] },
    { id: "user_2", roles: [] },
  ]);
});

test("findByIdWithRoles() returns undefined when the user doesn't exist", async () => {
  db.set([]);
  assert.equal(await findByIdWithRoles("missing"), undefined);
});

test("findByIdWithRoles() returns the single grouped row", async () => {
  db.set([{ user: { id: "user_1" }, roleSlug: "admin", roleName: "Admin" }]);

  assert.deepEqual(await findByIdWithRoles("user_1"), {
    id: "user_1",
    roles: [{ slug: "admin", name: "Admin" }],
  });
});

test("findRolesAndPermissionsByClerkId() returns undefined when there is no matching user", async () => {
  db.set([]);
  assert.equal(await findRolesAndPermissionsByClerkId("clerk_missing"), undefined);
});

test("findRolesAndPermissionsByClerkId() dedupes roles and permission codes across rows", async () => {
  const user = { id: "user_1", clerkId: "clerk_1" };
  db.set([
    { user, roleSlug: "admin", roleName: "Admin", permissionCode: "products.view" },
    { user, roleSlug: "admin", roleName: "Admin", permissionCode: "products.create" },
    { user, roleSlug: "manager", roleName: "Manager", permissionCode: "products.view" },
  ]);

  assert.deepEqual(await findRolesAndPermissionsByClerkId("clerk_1"), {
    user,
    roles: [
      { slug: "admin", name: "Admin" },
      { slug: "manager", name: "Manager" },
    ],
    permissionCodes: ["products.view", "products.create"],
  });
});

test("findRolesAndPermissionsByClerkId() returns empty roles/permissions for a user with none", async () => {
  const user = { id: "user_1" };
  db.set([{ user, roleSlug: null, roleName: null, permissionCode: null }]);

  assert.deepEqual(await findRolesAndPermissionsByClerkId("clerk_1"), {
    user,
    roles: [],
    permissionCodes: [],
  });
});

test("create() returns the inserted row", async () => {
  db.set([{ id: "user_1", email: "ana@example.com" }]);
  const created = await create({ email: "ana@example.com" } as never);
  assert.deepEqual(created, { id: "user_1", email: "ana@example.com" });
});

test("buildUpsertByClerkId() defaults optional fields to null", () => {
  buildUpsertByClerkId({
    clerkId: "clerk_1",
    email: "ana@example.com",
  } as never);

  const [config] = db.argsFor("onConflictDoUpdate") ?? [];
  const set = (config as { set: Record<string, unknown> }).set;
  assert.equal(set.firstName, null);
  assert.equal(set.lastName, null);
  assert.equal(set.imageUrl, null);
});

test("buildUpsertByClerkId() keeps provided optional fields", () => {
  buildUpsertByClerkId({
    clerkId: "clerk_1",
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "Pérez",
  } as never);

  const [config] = db.argsFor("onConflictDoUpdate") ?? [];
  const set = (config as { set: Record<string, unknown> }).set;
  assert.equal(set.firstName, "Ana");
  assert.equal(set.lastName, "Pérez");
});

test("attachStripeCustomerId() returns the updated row when it wins the race", async () => {
  db.set([{ id: "user_1", stripeCustomerId: "cus_1" }]);
  const updated = await attachStripeCustomerId("user_1", "cus_1");
  assert.deepEqual(updated, { id: "user_1", stripeCustomerId: "cus_1" });
});

test("attachStripeCustomerId() returns undefined when it loses the race", async () => {
  db.set([]);
  assert.equal(await attachStripeCustomerId("user_1", "cus_1"), undefined);
});

test("buildUpdate() passes the given data straight to set()", () => {
  buildUpdate("user_1", { firstName: "Ana" });
  assert.deepEqual(db.argsFor("set"), [{ firstName: "Ana" }]);
});

test("update() returns the updated row", async () => {
  db.set([{ id: "user_1", firstName: "Ana" }]);
  assert.deepEqual(await update("user_1", { firstName: "Ana" }), { id: "user_1", firstName: "Ana" });
});

test("setActive() delegates to update() with only isActive", async () => {
  db.set([{ id: "user_1", isActive: false }]);
  await setActive("user_1", false);
  assert.deepEqual(db.argsFor("set"), [{ isActive: false }]);
});

test("buildDeactivateByClerkId() sets isActive to false", () => {
  buildDeactivateByClerkId("clerk_1");
  assert.deepEqual(db.argsFor("set"), [{ isActive: false }]);
});
