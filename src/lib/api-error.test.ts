import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";

import { getApiErrorMessage } from "@/lib/api-error.ts";

function axiosErrorWithData(data: unknown): AxiosError {
  const error = new AxiosError("request failed");
  error.response = {
    data,
    status: 409,
    statusText: "Conflict",
    headers: {},
    config: {} as never,
  };
  return error;
}

test("returns the API error message when present", () => {
  const error = axiosErrorWithData({ error: "El slug ya existe" });
  assert.equal(getApiErrorMessage(error, "fallback"), "El slug ya existe");
});

test("falls back when response data has no error field", () => {
  const error = axiosErrorWithData({});
  assert.equal(getApiErrorMessage(error, "fallback"), "fallback");
});

test("falls back when the error field is an empty string", () => {
  const error = axiosErrorWithData({ error: "" });
  assert.equal(getApiErrorMessage(error, "fallback"), "fallback");
});

test("falls back when the error field is not a string", () => {
  const error = axiosErrorWithData({ error: 500 });
  assert.equal(getApiErrorMessage(error, "fallback"), "fallback");
});

test("falls back for a non-axios error", () => {
  assert.equal(getApiErrorMessage(new Error("boom"), "fallback"), "fallback");
});

test("falls back for a non-error value", () => {
  assert.equal(getApiErrorMessage("not an error", "fallback"), "fallback");
});
