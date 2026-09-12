import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { mockStripe } from "@/testing/mocks/stripe.mock.ts";

type FakeProduct = {
  id: string;
  name: string;
  isActive: boolean;
  stock: number;
  priceCents: number;
} | undefined;

let products: Record<string, FakeProduct> = {};
mock.module("@/server/repositories/product.repository", {
  exports: { findById: async (id: string) => products[id] },
});

const createWithItemsMock = mock.fn(async (_values: unknown, _items: unknown[]) => {});
mock.module("@/server/repositories/order.repository", {
  exports: { createWithItems: createWithItemsMock },
});

mock.module("@/server/services/saved-card.service", {
  exports: { ensureStripeCustomer: async () => "cus_1" },
});

let sessionsCreate = async (params: unknown): Promise<Record<string, unknown>> => ({
  id: "cs_1",
  url: "https://checkout.stripe.com/cs_1",
});
mockStripe({ checkout: { sessions: { create: (params: unknown) => sessionsCreate(params) } } });

const { createCheckoutSession } = await import("@/server/services/checkout.service.ts");

const actor = { id: "user_1", email: "ana@example.com" };

test.beforeEach(() => {
  products = {};
  createWithItemsMock.mock.resetCalls();
  sessionsCreate = async () => ({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });
});

test("reports unavailable when a product no longer exists", async () => {
  const result = await createCheckoutSession(
    actor,
    [{ productId: "missing", quantity: 1 }] as never,
    { useSavedCards: false },
  );

  assert.equal(result.status, "unavailable");
  assert.equal(createWithItemsMock.mock.calls.length, 0);
});

test("reports unavailable when a product was deactivated", async () => {
  products = { prod_1: { id: "prod_1", name: "Laptop", isActive: false, stock: 5, priceCents: 1000 } };

  const result = await createCheckoutSession(
    actor,
    [{ productId: "prod_1", quantity: 1 }] as never,
    { useSavedCards: false },
  );

  assert.equal(result.status, "unavailable");
  assert.ok(result.status === "unavailable" && result.productName === "Laptop");
});

test("reports out of stock when stock is exactly zero", async () => {
  products = { prod_1: { id: "prod_1", name: "Laptop", isActive: true, stock: 0, priceCents: 1000 } };

  const result = await createCheckoutSession(
    actor,
    [{ productId: "prod_1", quantity: 1 }] as never,
    { useSavedCards: false },
  );

  assert.equal(result.status, "unavailable");
  assert.ok(result.status === "unavailable" && result.message === "Laptop se ha agotado");
});

test("reports the remaining units when stock is short but not zero", async () => {
  products = { prod_1: { id: "prod_1", name: "Laptop", isActive: true, stock: 2, priceCents: 1000 } };

  const result = await createCheckoutSession(
    actor,
    [{ productId: "prod_1", quantity: 5 }] as never,
    { useSavedCards: false },
  );

  assert.ok(
    result.status === "unavailable" &&
      result.message === "Solo quedan 2 unidades de Laptop",
  );
});

test("creates the session and the order with the revalidated total", async () => {
  products = {
    prod_1: { id: "prod_1", name: "Laptop", isActive: true, stock: 5, priceCents: 100000 },
    prod_2: { id: "prod_2", name: "Mouse", isActive: true, stock: 10, priceCents: 5000 },
  };

  const result = await createCheckoutSession(
    actor,
    [
      { productId: "prod_1", quantity: 1 },
      { productId: "prod_2", quantity: 2 },
    ] as never,
    { useSavedCards: false },
  );

  assert.equal(result.status, "created");
  assert.equal(createWithItemsMock.mock.calls.length, 1);

  const [values, items] = createWithItemsMock.mock.calls[0].arguments as [
    { totalCents: number; status: string },
    { productId: string; quantity: number }[],
  ];
  assert.equal(values.totalCents, 110000); // 100000*1 + 5000*2
  assert.equal(values.status, "pending");
  assert.equal(items.length, 2);
});

test("throws when Stripe creates the session without a redirect url", async () => {
  products = { prod_1: { id: "prod_1", name: "Laptop", isActive: true, stock: 5, priceCents: 1000 } };
  sessionsCreate = async () => ({ id: "cs_1", url: null });

  await assert.rejects(() =>
    createCheckoutSession(actor, [{ productId: "prod_1", quantity: 1 }] as never, {
      useSavedCards: false,
    }),
  );
});

test("filters saved cards to always-reusable ones when useSavedCards is true", async () => {
  products = { prod_1: { id: "prod_1", name: "Laptop", isActive: true, stock: 5, priceCents: 1000 } };
  let capturedFilters: string[] | undefined;
  sessionsCreate = async (params) => {
    capturedFilters = (
      params as { saved_payment_method_options: { allow_redisplay_filters: string[] } }
    ).saved_payment_method_options.allow_redisplay_filters;
    return { id: "cs_1", url: "https://checkout.stripe.com/cs_1" };
  };

  await createCheckoutSession(actor, [{ productId: "prod_1", quantity: 1 }] as never, {
    useSavedCards: true,
  });

  assert.deepEqual(capturedFilters, ["always"]);
});

test("filters out saved cards when useSavedCards is false", async () => {
  products = { prod_1: { id: "prod_1", name: "Laptop", isActive: true, stock: 5, priceCents: 1000 } };
  let capturedFilters: string[] | undefined;
  sessionsCreate = async (params) => {
    capturedFilters = (
      params as { saved_payment_method_options: { allow_redisplay_filters: string[] } }
    ).saved_payment_method_options.allow_redisplay_filters;
    return { id: "cs_1", url: "https://checkout.stripe.com/cs_1" };
  };

  await createCheckoutSession(actor, [{ productId: "prod_1", quantity: 1 }] as never, {
    useSavedCards: false,
  });

  assert.deepEqual(capturedFilters, ["limited"]);
});
