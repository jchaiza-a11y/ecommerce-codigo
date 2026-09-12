import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { mockStripe } from "@/testing/mocks/stripe.mock.ts";

type FakeOrder = {
  status: string;
  stripePaymentIntentId: string | null;
} | undefined;

let orderResult: FakeOrder;
mock.module("@/server/repositories/order.repository", {
  exports: { findByIdAndUserId: async () => orderResult },
});

let retrievePaymentIntent = async (_id: string, _opts: unknown): Promise<unknown> => ({});
mockStripe({
  paymentIntents: { retrieve: (...args: [string, unknown]) => retrievePaymentIntent(...args) },
});

const { resolveOrderReceiptUrl } = await import("@/server/services/order-receipt.service.ts");

test("returns not_found when the order doesn't belong to the user", async () => {
  orderResult = undefined;
  assert.deepEqual(await resolveOrderReceiptUrl("user_1", "order_1"), { status: "not_found" });
});

test("returns not_found when the order hasn't been paid", async () => {
  orderResult = { status: "pending", stripePaymentIntentId: null };
  assert.deepEqual(await resolveOrderReceiptUrl("user_1", "order_1"), { status: "not_found" });
});

test("returns url: null when the order has no payment intent yet", async () => {
  orderResult = { status: "paid", stripePaymentIntentId: null };
  assert.deepEqual(await resolveOrderReceiptUrl("user_1", "order_1"), {
    status: "ok",
    url: null,
  });
});

test("returns stripe_unavailable when Stripe throws", async () => {
  orderResult = { status: "paid", stripePaymentIntentId: "pi_1" };
  retrievePaymentIntent = async () => {
    throw new Error("Stripe is down");
  };

  assert.deepEqual(await resolveOrderReceiptUrl("user_1", "order_1"), {
    status: "stripe_unavailable",
  });
});

test("returns url: null when latest_charge wasn't expanded", async () => {
  orderResult = { status: "paid", stripePaymentIntentId: "pi_1" };
  retrievePaymentIntent = async () => ({ latest_charge: "ch_1" });

  assert.deepEqual(await resolveOrderReceiptUrl("user_1", "order_1"), {
    status: "ok",
    url: null,
  });
});

test("returns url: null when there is no charge yet", async () => {
  orderResult = { status: "paid", stripePaymentIntentId: "pi_1" };
  retrievePaymentIntent = async () => ({ latest_charge: null });

  assert.deepEqual(await resolveOrderReceiptUrl("user_1", "order_1"), {
    status: "ok",
    url: null,
  });
});

test("returns the receipt url from the expanded charge", async () => {
  orderResult = { status: "paid", stripePaymentIntentId: "pi_1" };
  retrievePaymentIntent = async () => ({
    latest_charge: { receipt_url: "https://pay.stripe.com/receipts/abc" },
  });

  assert.deepEqual(await resolveOrderReceiptUrl("user_1", "order_1"), {
    status: "ok",
    url: "https://pay.stripe.com/receipts/abc",
  });
});
