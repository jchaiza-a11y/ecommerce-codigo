import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

import { mockStripe } from "@/testing/mocks/stripe.mock.ts";

type FakeUser = { id: string; stripeCustomerId: string | null } | undefined;

let userById: FakeUser;
/** Resultados consumidos en orden por llamadas sucesivas a `findById` dentro
 * de un mismo test (ej. la relectura tras perder la carrera de `attach`);
 * vacía la cola cae de nuevo a `userById`. */
let findByIdQueue: FakeUser[] = [];
let attachResult: FakeUser;
const attachStripeCustomerIdMock = mock.fn(async (_userId: string, _customerId: string) => attachResult);

let upsertResult: unknown;
let findByIdAndUserIdResult: { id: string; stripePaymentMethodId: string } | undefined;
const deleteByIdMock = mock.fn(async (_id: string) => {});

mock.module("@/server/repositories/user.repository", {
  namedExports: {
    findById: async () => (findByIdQueue.length > 0 ? findByIdQueue.shift() : userById),
    attachStripeCustomerId: attachStripeCustomerIdMock,
  },
});

mock.module("@/server/repositories/payment-method.repository", {
  namedExports: {
    upsertByStripeId: async () => upsertResult,
    findByIdAndUserId: async () => findByIdAndUserIdResult,
    deleteById: deleteByIdMock,
  },
});

let customersCreate = async (_params: unknown) => ({ id: "cus_new" });
let sessionsCreate = async (_params: unknown): Promise<Record<string, unknown>> => ({
  id: "cs_1",
  url: "https://checkout.stripe.com/cs_1",
});
let sessionsRetrieve = async (_id: string, _opts: unknown): Promise<unknown> => ({});
const paymentMethodsUpdate = async (_id: string, _opts: unknown) => ({});
let paymentMethodsDetach = async (_id: string) => ({});

mockStripe({
  customers: { create: (params: unknown) => customersCreate(params) },
  checkout: {
    sessions: {
      create: (params: unknown) => sessionsCreate(params),
      retrieve: (...args: [string, unknown]) => sessionsRetrieve(...args),
    },
  },
  paymentMethods: {
    update: (...args: [string, unknown]) => paymentMethodsUpdate(...args),
    detach: (id: string) => paymentMethodsDetach(id),
  },
});

const {
  toSavedCard,
  ensureStripeCustomer,
  createSetupSession,
  savePaymentMethodFromSetupSession,
  removeSavedCard,
} = await import("@/server/services/saved-card.service.ts");

test.beforeEach(() => {
  attachStripeCustomerIdMock.mock.resetCalls();
  deleteByIdMock.mock.resetCalls();
  findByIdQueue = [];
});

test("toSavedCard() maps a payment_methods row to the public contract", () => {
  const createdAt = new Date("2026-01-15T10:00:00.000Z");
  assert.deepEqual(
    toSavedCard({
      id: "pm_1",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
      createdAt,
    } as never),
    { id: "pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030, createdAt: createdAt.toISOString() },
  );
});

test("ensureStripeCustomer() returns the existing Stripe customer id without creating one", async () => {
  userById = { id: "user_1", stripeCustomerId: "cus_existing" };

  const customerId = await ensureStripeCustomer({ id: "user_1", email: "ana@example.com" });

  assert.equal(customerId, "cus_existing");
});

test("ensureStripeCustomer() creates and attaches a customer when the user has none", async () => {
  userById = { id: "user_1", stripeCustomerId: null };
  attachResult = { id: "user_1", stripeCustomerId: "cus_new" };
  customersCreate = async () => ({ id: "cus_new" });

  const customerId = await ensureStripeCustomer({ id: "user_1", email: "ana@example.com" });

  assert.equal(customerId, "cus_new");
});

test("ensureStripeCustomer() rereads the row when it loses the attach race", async () => {
  // Primera llamada a findById (existing) y la relectura tras perder la
  // carrera de attach, en ese orden.
  findByIdQueue = [
    { id: "user_1", stripeCustomerId: null },
    { id: "user_1", stripeCustomerId: "cus_winner" },
  ];
  attachResult = undefined; // perdió la carrera
  customersCreate = async () => ({ id: "cus_new" });

  const customerId = await ensureStripeCustomer({ id: "user_1", email: "ana@example.com" });

  assert.equal(customerId, "cus_winner");
});

test("createSetupSession() returns the Checkout Session url", async () => {
  userById = { id: "user_1", stripeCustomerId: "cus_1" };
  sessionsCreate = async () => ({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });

  const url = await createSetupSession({ id: "user_1", email: "ana@example.com" });
  assert.equal(url, "https://checkout.stripe.com/cs_1");
});

test("createSetupSession() throws when Stripe returns no redirect url", async () => {
  userById = { id: "user_1", stripeCustomerId: "cus_1" };
  sessionsCreate = async () => ({ id: "cs_1", url: null });

  await assert.rejects(() => createSetupSession({ id: "user_1", email: "ana@example.com" }));
});

test("savePaymentMethodFromSetupSession() returns not_found when the session doesn't exist in Stripe", async () => {
  sessionsRetrieve = async () => {
    throw { code: "resource_missing" };
  };

  assert.deepEqual(
    await savePaymentMethodFromSetupSession("cs_missing", "user_1"),
    { status: "not_found" },
  );
});

test("savePaymentMethodFromSetupSession() rethrows a non resource_missing Stripe error", async () => {
  sessionsRetrieve = async () => {
    throw new Error("network down");
  };

  await assert.rejects(() => savePaymentMethodFromSetupSession("cs_1", "user_1"));
});

test("savePaymentMethodFromSetupSession() returns not_found for a session belonging to another user", async () => {
  sessionsRetrieve = async () => ({
    mode: "setup",
    client_reference_id: "user_other",
    status: "complete",
  });

  assert.deepEqual(
    await savePaymentMethodFromSetupSession("cs_1", "user_1"),
    { status: "not_found" },
  );
});

test("savePaymentMethodFromSetupSession() returns pending when the session isn't complete", async () => {
  sessionsRetrieve = async () => ({
    mode: "setup",
    client_reference_id: "user_1",
    status: "open",
  });

  assert.deepEqual(
    await savePaymentMethodFromSetupSession("cs_1", "user_1"),
    { status: "pending" },
  );
});

test("savePaymentMethodFromSetupSession() returns pending when the payment method has no card yet", async () => {
  sessionsRetrieve = async () => ({
    mode: "setup",
    client_reference_id: "user_1",
    status: "complete",
    setup_intent: { payment_method: { id: "pm_1" } },
  });

  assert.deepEqual(
    await savePaymentMethodFromSetupSession("cs_1", "user_1"),
    { status: "pending" },
  );
});

test("savePaymentMethodFromSetupSession() saves the card and returns it", async () => {
  sessionsRetrieve = async () => ({
    mode: "setup",
    client_reference_id: "user_1",
    status: "complete",
    setup_intent: {
      payment_method: {
        id: "pm_1",
        card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
      },
    },
  });
  upsertResult = {
    id: "pm_local_1",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const result = await savePaymentMethodFromSetupSession("cs_1", "user_1");

  assert.equal(result.status, "saved");
  assert.ok(result.status === "saved" && result.card.id === "pm_local_1");
});

test("savePaymentMethodFromSetupSession() returns not_found when the card already belongs to someone else", async () => {
  sessionsRetrieve = async () => ({
    mode: "setup",
    client_reference_id: "user_1",
    status: "complete",
    setup_intent: {
      payment_method: {
        id: "pm_1",
        card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
      },
    },
  });
  upsertResult = undefined;

  assert.deepEqual(
    await savePaymentMethodFromSetupSession("cs_1", "user_1"),
    { status: "not_found" },
  );
});

test("removeSavedCard() returns not_found when the card doesn't belong to the user", async () => {
  findByIdAndUserIdResult = undefined;

  assert.deepEqual(await removeSavedCard("user_1", "pm_1"), { status: "not_found" });
  assert.equal(deleteByIdMock.mock.calls.length, 0);
});

test("removeSavedCard() detaches from Stripe and deletes the local row", async () => {
  findByIdAndUserIdResult = { id: "pm_local_1", stripePaymentMethodId: "pm_1" };
  paymentMethodsDetach = async () => ({});

  assert.deepEqual(await removeSavedCard("user_1", "pm_local_1"), { status: "removed" });
  assert.equal(deleteByIdMock.mock.calls.length, 1);
});

test("removeSavedCard() still deletes locally when Stripe says the method is already gone", async () => {
  findByIdAndUserIdResult = { id: "pm_local_1", stripePaymentMethodId: "pm_1" };
  paymentMethodsDetach = async () => {
    throw { code: "resource_missing" };
  };

  assert.deepEqual(await removeSavedCard("user_1", "pm_local_1"), { status: "removed" });
  assert.equal(deleteByIdMock.mock.calls.length, 1);
});

test("removeSavedCard() reports stripe_unavailable and keeps the local row on an unexpected Stripe error", async () => {
  findByIdAndUserIdResult = { id: "pm_local_1", stripePaymentMethodId: "pm_1" };
  paymentMethodsDetach = async () => {
    throw new Error("network down");
  };

  assert.deepEqual(await removeSavedCard("user_1", "pm_local_1"), { status: "stripe_unavailable" });
  assert.equal(deleteByIdMock.mock.calls.length, 0);
});
