import test from "node:test";
import assert from "node:assert/strict";

import { formatDateTime, getAuditActionLabel } from "@/modules/audit-logs/constants.ts";

test("getAuditActionLabel() translates a known action", () => {
  assert.equal(getAuditActionLabel("user.created"), "Usuario creado desde el panel");
});

test("getAuditActionLabel() falls back to the raw code for an unknown action", () => {
  assert.equal(getAuditActionLabel("order.paid"), "order.paid");
});

test("getAuditActionLabel() falls back for an empty string", () => {
  assert.equal(getAuditActionLabel(""), "");
});

test("formatDateTime() formats date and time in es-ES", () => {
  // Construido en hora local: no depende del timezone de la máquina que corre el test.
  assert.equal(formatDateTime(new Date(2026, 2, 5, 14, 5)), "05/03/2026, 14:05");
});
