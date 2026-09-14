import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getProducts, createProduct, updateProduct, deleteProduct, getApiErrorMessage, isConflictError } =
  await import("@/modules/products/services/product.service.ts");

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getProducts() hits GET /api/products and returns the response data", async () => {
  apiMock.on("get", async () => ({ data: [{ id: "prod_1" }] }));

  assert.deepEqual(await getProducts(), [{ id: "prod_1" }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/products");
});

test("createProduct() posts the input and returns the created product", async () => {
  apiMock.on("post", async () => ({ data: { id: "prod_1" } }));

  const created = await createProduct({ name: "Laptop" } as never);

  assert.deepEqual(created, { id: "prod_1" });
  assert.equal(apiMock.argsFor("post")?.[0], "/api/products");
});

test("updateProduct() patches the resource by id", async () => {
  apiMock.on("patch", async () => ({ data: { id: "prod_1", name: "Nuevo" } }));

  await updateProduct("prod_1", { name: "Nuevo" });

  assert.equal(apiMock.argsFor("patch")?.[0], "/api/products/prod_1");
});

test("deleteProduct() calls DELETE on the resource by id", async () => {
  apiMock.on("delete", async () => ({ data: undefined }));

  await deleteProduct("prod_1");

  assert.equal(apiMock.argsFor("delete")?.[0], "/api/products/prod_1");
});

test("getApiErrorMessage() returns the API's error message when present", () => {
  const error = new AxiosError("fail");
  error.response = { data: { error: "El slug ya existe" }, status: 409, statusText: "", headers: {}, config: {} as never };

  assert.equal(getApiErrorMessage(error, "fallback"), "El slug ya existe");
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
