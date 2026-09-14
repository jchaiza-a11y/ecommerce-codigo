import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const {
  getUsers,
  createUser,
  updateUser,
  assignRoles,
  getApiErrorMessage,
  isConflictError,
  isForbiddenError,
} = await import("@/modules/users/services/user.service.ts");

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getUsers() hits GET /api/admin/users and returns the response data", async () => {
  apiMock.on("get", async () => ({ data: [{ id: "user_1" }] }));

  assert.deepEqual(await getUsers(), [{ id: "user_1" }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/admin/users");
});

test("createUser() posts the input and returns the response", async () => {
  apiMock.on("post", async () => ({ data: { id: "user_1", temporaryPassword: "X" } }));

  await createUser({ email: "ana@example.com" } as never);

  assert.equal(apiMock.argsFor("post")?.[0], "/api/admin/users");
});

test("updateUser() patches the resource by id", async () => {
  apiMock.on("patch", async () => ({ data: { id: "user_1" } }));

  await updateUser("user_1", { isActive: false });

  assert.equal(apiMock.argsFor("patch")?.[0], "/api/admin/users/user_1");
});

test("assignRoles() PUTs to the roles sub-resource", async () => {
  apiMock.on("put", async () => ({ data: { id: "user_1" } }));

  await assignRoles("user_1", { roleSlugs: ["admin"] });

  assert.equal(apiMock.argsFor("put")?.[0], "/api/admin/users/user_1/roles");
});

test("getApiErrorMessage() returns the API's error message when present", () => {
  const error = new AxiosError("fail");
  error.response = { data: { error: "Ya existe un usuario con ese correo" }, status: 409, statusText: "", headers: {}, config: {} as never };

  assert.equal(getApiErrorMessage(error, "fallback"), "Ya existe un usuario con ese correo");
});

test("isConflictError() is true only for a 409 axios error", () => {
  const conflict = new AxiosError("fail");
  conflict.response = { data: {}, status: 409, statusText: "", headers: {}, config: {} as never };

  assert.equal(isConflictError(conflict), true);
});

test("isForbiddenError() is true for a 403 axios error", () => {
  const forbidden = new AxiosError("fail");
  forbidden.response = { data: {}, status: 403, statusText: "", headers: {}, config: {} as never };

  assert.equal(isForbiddenError(forbidden), true);
});

test("isForbiddenError() is false for a 409 or non-axios error", () => {
  const conflict = new AxiosError("fail");
  conflict.response = { data: {}, status: 409, statusText: "", headers: {}, config: {} as never };

  assert.equal(isForbiddenError(conflict), false);
  assert.equal(isForbiddenError(new Error("boom")), false);
});
