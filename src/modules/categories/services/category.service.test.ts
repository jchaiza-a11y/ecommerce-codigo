import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getCategories, createCategory, updateCategory, deleteCategory, getApiErrorMessage, isConflictError } =
  await import("@/modules/categories/services/category.service.ts");

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getCategories() hits GET /api/categories and returns the response data", async () => {
  apiMock.on("get", async () => ({ data: [{ id: "cat_1" }] }));

  assert.deepEqual(await getCategories(), [{ id: "cat_1" }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/categories");
});

test("createCategory() posts the input and returns the created category", async () => {
  apiMock.on("post", async () => ({ data: { id: "cat_1" } }));

  assert.deepEqual(await createCategory({ name: "Laptops" } as never), { id: "cat_1" });
  assert.equal(apiMock.argsFor("post")?.[0], "/api/categories");
});

test("updateCategory() patches the resource by id", async () => {
  apiMock.on("patch", async () => ({ data: { id: "cat_1" } }));

  await updateCategory("cat_1", { name: "Nuevo" });

  assert.equal(apiMock.argsFor("patch")?.[0], "/api/categories/cat_1");
});

test("deleteCategory() calls DELETE on the resource by id", async () => {
  apiMock.on("delete", async () => ({ data: undefined }));

  await deleteCategory("cat_1");

  assert.equal(apiMock.argsFor("delete")?.[0], "/api/categories/cat_1");
});

test("getApiErrorMessage() returns the API's error message when present", () => {
  const error = new AxiosError("fail");
  error.response = { data: { error: "Ya existe una categoría con ese slug" }, status: 409, statusText: "", headers: {}, config: {} as never };

  assert.equal(getApiErrorMessage(error, "fallback"), "Ya existe una categoría con ese slug");
});

test("getApiErrorMessage() falls back for a non-axios error", () => {
  assert.equal(getApiErrorMessage(new Error("boom"), "fallback"), "fallback");
});

test("isConflictError() is true only for a 409 axios error", () => {
  const conflict = new AxiosError("fail");
  conflict.response = { data: {}, status: 409, statusText: "", headers: {}, config: {} as never };

  assert.equal(isConflictError(conflict), true);
  assert.equal(isConflictError(new Error("boom")), false);
});
