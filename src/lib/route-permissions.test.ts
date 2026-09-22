import test from "node:test";
import assert from "node:assert/strict";

import {
  getFirstAllowedAdminPath,
  getRequiredPermission,
} from "@/lib/route-permissions.ts";

test("returns the permission for an exact admin section path", () => {
  assert.equal(getRequiredPermission("/admin/products"), "products.view");
});

test("returns the permission for a nested path under a section", () => {
  assert.equal(getRequiredPermission("/admin/products/123"), "products.view");
});

test("falls back to dashboard.view for the bare /admin path", () => {
  assert.equal(getRequiredPermission("/admin"), "dashboard.view");
});

test("returns undefined for the unguarded forbidden page", () => {
  assert.equal(getRequiredPermission("/admin/forbidden"), undefined);
});

test("returns undefined for a subpath of the unguarded forbidden page", () => {
  assert.equal(getRequiredPermission("/admin/forbidden/details"), undefined);
});

test("returns undefined for a path outside /admin", () => {
  assert.equal(getRequiredPermission("/products"), undefined);
});

test("does not match a path that merely starts with the prefix text", () => {
  assert.equal(getRequiredPermission("/adminfoo"), undefined);
});

test("matches the API admin subpath equivalents", () => {
  assert.equal(getRequiredPermission("/api/admin/roles"), "roles.view");
});

test("guards the orders section with orders.view, not the generic dashboard.view", () => {
  assert.equal(getRequiredPermission("/admin/orders"), "orders.view");
});

test("guards the orders API with orders.view", () => {
  assert.equal(getRequiredPermission("/api/admin/orders"), "orders.view");
});

test("guards a nested orders API path (detail and receipt) with orders.view", () => {
  assert.equal(
    getRequiredPermission(
      "/api/admin/orders/550e8400-e29b-41d4-a716-446655440000/receipt",
    ),
    "orders.view",
  );
});

test("guards the dashboard metrics endpoint with dashboard.view", () => {
  assert.equal(getRequiredPermission("/api/admin/metrics"), "dashboard.view");
});

test("returns null for an empty permission set", () => {
  assert.equal(getFirstAllowedAdminPath([]), null);
});

test("returns the path for the only matching permission", () => {
  assert.equal(getFirstAllowedAdminPath(["audit_logs.view"]), "/admin/audit-logs");
});

test("returns the first matching section in menu order when several match", () => {
  assert.equal(
    getFirstAllowedAdminPath(["categories.view", "products.view"]),
    "/admin/products",
  );
});

test("falls back to the orders section for a permission set with only orders.view", () => {
  assert.equal(getFirstAllowedAdminPath(["orders.view"]), "/admin/orders");
});

test("returns null when permissions don't match any admin section", () => {
  assert.equal(getFirstAllowedAdminPath(["dashboard.view"]), null);
});
