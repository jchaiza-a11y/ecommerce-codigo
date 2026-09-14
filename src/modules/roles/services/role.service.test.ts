import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getRoles } = await import("@/modules/roles/services/role.service.ts");

test("getRoles() hits GET /api/admin/roles and returns the response data", async () => {
  apiMock.on("get", async () => ({ data: [{ id: "role_1", name: "Admin", permissionCodes: [] }] }));

  assert.deepEqual(await getRoles(), [{ id: "role_1", name: "Admin", permissionCodes: [] }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/admin/roles");
});

test("getRoles() returns [] when the API responds with no roles", async () => {
  apiMock.on("get", async () => ({ data: [] }));

  assert.deepEqual(await getRoles(), []);
});
