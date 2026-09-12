import test from "node:test";
import assert from "node:assert/strict";

import { getPermissionLabel } from "@/modules/roles/constants/permission-labels.ts";

test("getPermissionLabel() translates a known permission code", () => {
  assert.equal(getPermissionLabel("products.view"), "Puede ver el catálogo de productos");
});

test("getPermissionLabel() falls back to the raw code for an unknown permission", () => {
  assert.equal(getPermissionLabel("unknown.code"), "unknown.code");
});

test("getPermissionLabel() falls back for an empty string", () => {
  assert.equal(getPermissionLabel(""), "");
});
