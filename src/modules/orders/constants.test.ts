import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_ORDER_LIMIT,
  EMPTY_ADMIN_ORDER_DRAFT,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  toAdminOrderQuery,
} from "@/modules/orders/constants.ts";
import { ORDER_STATUS_VALUES } from "@/modules/orders/schemas/admin-order.schema.ts";

/** Instante local, para comparar sin depender de la zona de la máquina. */
function localInstant(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toISOString();
}

test("toAdminOrderQuery() leaves every filter undefined for an empty draft", () => {
  assert.deepEqual(toAdminOrderQuery(EMPTY_ADMIN_ORDER_DRAFT), {
    from: undefined,
    to: undefined,
    status: undefined,
    customer: undefined,
  });
});

test("toAdminOrderQuery() reads the dates as local midnight, not as UTC", () => {
  const query = toAdminOrderQuery({
    ...EMPTY_ADMIN_ORDER_DRAFT,
    from: "2026-03-10",
  });

  assert.equal(query.from, localInstant(2026, 3, 10));
});

// El filtro SQL es `[from, to)`: mandar el propio día dejaría fuera los pedidos
// de esa tarde (§Notas, zona horaria).
test("toAdminOrderQuery() pushes `to` to the start of the next day", () => {
  const query = toAdminOrderQuery({
    ...EMPTY_ADMIN_ORDER_DRAFT,
    to: "2026-03-10",
  });

  assert.equal(query.to, localInstant(2026, 3, 11));
});

test("toAdminOrderQuery() rolls the exclusive `to` over a month boundary", () => {
  const query = toAdminOrderQuery({
    ...EMPTY_ADMIN_ORDER_DRAFT,
    to: "2026-01-31",
  });

  assert.equal(query.to, localInstant(2026, 2, 1));
});

test("toAdminOrderQuery() ignores a malformed date instead of sending NaN", () => {
  const query = toAdminOrderQuery({
    ...EMPTY_ADMIN_ORDER_DRAFT,
    from: "10/03/2026",
    to: "",
  });

  assert.equal(query.from, undefined);
  assert.equal(query.to, undefined);
});

test("toAdminOrderQuery() trims the customer text", () => {
  assert.equal(
    toAdminOrderQuery({ ...EMPTY_ADMIN_ORDER_DRAFT, customer: "  ana  " })
      .customer,
    "ana",
  );
});

// Un `customer` vacío se omite en origen: el endpoint lo rechaza con 400.
test("toAdminOrderQuery() drops a blank customer", () => {
  assert.equal(
    toAdminOrderQuery({ ...EMPTY_ADMIN_ORDER_DRAFT, customer: "   " }).customer,
    undefined,
  );
});

test("toAdminOrderQuery() keeps a known status and discards an unknown one", () => {
  assert.equal(
    toAdminOrderQuery({ ...EMPTY_ADMIN_ORDER_DRAFT, status: "paid" }).status,
    "paid",
  );
  assert.equal(
    toAdminOrderQuery({ ...EMPTY_ADMIN_ORDER_DRAFT, status: "refunded" }).status,
    undefined,
  );
});

test("ORDER_STATUS_OPTIONS covers every status of the enum", () => {
  assert.deepEqual(
    ORDER_STATUS_OPTIONS.map((option) => option.value),
    ORDER_STATUS_VALUES,
  );
  assert.deepEqual(
    ORDER_STATUS_OPTIONS.map((option) => option.label),
    ORDER_STATUS_VALUES.map((status) => ORDER_STATUS_LABELS[status]),
  );
});

test("ADMIN_ORDER_LIMIT is re-exported from the schema, not redefined", () => {
  assert.equal(ADMIN_ORDER_LIMIT, 500);
});
