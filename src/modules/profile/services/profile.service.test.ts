import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { confirmPasswordChanged, getApiErrorMessage } = await import(
  "@/modules/profile/services/profile.service.ts"
);

test("confirmPasswordChanged() posts to /api/profile/password-changed", async () => {
  apiMock.on("post", async () => ({ data: { mustChangePassword: false } }));

  const result = await confirmPasswordChanged();

  assert.deepEqual(result, { mustChangePassword: false });
  assert.equal(apiMock.argsFor("post")?.[0], "/api/profile/password-changed");
});

test("getApiErrorMessage() returns the API's error message when present", () => {
  const error = new AxiosError("fail");
  error.response = { data: { error: "No se pudo confirmar" }, status: 400, statusText: "", headers: {}, config: {} as never };

  assert.equal(getApiErrorMessage(error, "fallback"), "No se pudo confirmar");
});

test("getApiErrorMessage() falls back for a non-axios error", () => {
  assert.equal(getApiErrorMessage(new Error("boom"), "fallback"), "fallback");
});
