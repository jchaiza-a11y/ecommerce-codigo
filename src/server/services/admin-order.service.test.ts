import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

type FakeOrder =
  | {
      id: string;
      userId: string;
      status: string;
      totalCents: number;
      currency: string;
      createdAt: Date;
      items: Array<{
        id: string;
        productName: string;
        unitPriceCents: number;
        quantity: number;
        productId: string;
      }>;
    }
  | undefined;

type FakeUser =
  | {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }
  | undefined;

let orderResult: FakeOrder;
let userResult: FakeUser;

mock.module("@/server/repositories/order.repository", {
  namedExports: { findWithItems: async () => orderResult },
});
mock.module("@/server/repositories/user.repository", {
  namedExports: { findById: async () => userResult },
});

const { getAdminOrderDetail } = await import(
  "@/server/services/admin-order.service.ts"
);

const ORDER: NonNullable<FakeOrder> = {
  id: "order_1",
  userId: "user_1",
  status: "paid",
  totalCents: 12900,
  currency: "eur",
  createdAt: new Date("2026-03-01T10:00:00.000Z"),
  items: [
    {
      id: "item_1",
      productId: "prod_1",
      productName: "Teclado mecánico",
      unitPriceCents: 10900,
      quantity: 1,
    },
  ],
};

const CUSTOMER: NonNullable<FakeUser> = {
  id: "user_1",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
};

test.beforeEach(() => {
  orderResult = { ...ORDER };
  userResult = { ...CUSTOMER };
});

test("returns null when the order doesn't exist", async () => {
  orderResult = undefined;
  assert.equal(await getAdminOrderDetail("order_missing"), null);
});

test("maps header, customer and lines into the detail contract", async () => {
  assert.deepEqual(await getAdminOrderDetail("order_1"), {
    id: "order_1",
    createdAt: "2026-03-01T10:00:00.000Z",
    status: "paid",
    totalCents: 12900,
    currency: "eur",
    customer: { id: "user_1", name: "Ana Pérez", email: "ana@example.com" },
    items: [
      {
        id: "item_1",
        productName: "Teclado mecánico",
        unitPriceCents: 10900,
        quantity: 1,
      },
    ],
  });
});

test("reads the total from the order, never recomputed from the lines", async () => {
  orderResult = {
    ...ORDER,
    totalCents: 99900,
    items: [{ ...ORDER.items[0], unitPriceCents: 1, quantity: 1 }],
  };

  const detail = await getAdminOrderDetail("order_1");

  assert.equal(detail?.totalCents, 99900);
});

test("throws when the order references a user that doesn't exist", async () => {
  userResult = undefined;

  await assert.rejects(() => getAdminOrderDetail("order_1"), /user_1/);
});
