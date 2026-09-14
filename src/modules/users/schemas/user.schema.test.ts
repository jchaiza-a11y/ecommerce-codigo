import test from "node:test";
import assert from "node:assert/strict";

import {
  assignRolesSchema,
  createUserSchema,
  updateUserSchema,
} from "@/modules/users/schemas/user.schema.ts";

const validBase = { email: "ana@example.com", firstName: "Ana", roleSlugs: ["manager"] };

test("createUserSchema accepts a minimal valid user", () => {
  assert.equal(createUserSchema.safeParse(validBase).success, true);
});

test("createUserSchema rejects an invalid email", () => {
  assert.equal(
    createUserSchema.safeParse({ ...validBase, email: "not-an-email" }).success,
    false,
  );
});

test("createUserSchema rejects an empty firstName", () => {
  assert.equal(createUserSchema.safeParse({ ...validBase, firstName: "" }).success, false);
});

test("createUserSchema accepts an omitted lastName", () => {
  assert.equal(createUserSchema.safeParse(validBase).success, true);
});

test("createUserSchema rejects an empty roleSlugs list", () => {
  assert.equal(createUserSchema.safeParse({ ...validBase, roleSlugs: [] }).success, false);
});

test("createUserSchema accepts multiple roleSlugs", () => {
  assert.equal(
    createUserSchema.safeParse({ ...validBase, roleSlugs: ["manager", "employee"] }).success,
    true,
  );
});

test("updateUserSchema rejects an empty patch", () => {
  assert.equal(updateUserSchema.safeParse({}).success, false);
});

test("updateUserSchema accepts a single-field patch", () => {
  assert.equal(updateUserSchema.safeParse({ isActive: false }).success, true);
});

test("updateUserSchema still validates the fields it does receive", () => {
  assert.equal(updateUserSchema.safeParse({ firstName: "" }).success, false);
});

test("assignRolesSchema rejects an empty roleSlugs list", () => {
  assert.equal(assignRolesSchema.safeParse({ roleSlugs: [] }).success, false);
});

test("assignRolesSchema accepts a non-empty roleSlugs list", () => {
  assert.equal(assignRolesSchema.safeParse({ roleSlugs: ["admin"] }).success, true);
});
