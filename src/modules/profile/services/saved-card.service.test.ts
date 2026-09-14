import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { getSavedCards, createCardSetupSession, confirmSavedCard, deleteSavedCard } = await import(
  "@/modules/profile/services/saved-card.service.ts"
);

test.beforeEach(() => {
  apiMock.resetCalls();
});

test("getSavedCards() hits GET on the resource and unwraps items", async () => {
  apiMock.on("get", async () => ({ data: { items: [{ id: "pm_1" }] } }));

  assert.deepEqual(await getSavedCards(), [{ id: "pm_1" }]);
  assert.equal(apiMock.argsFor("get")?.[0], "/api/profile/payment-methods");
});

test("createCardSetupSession() posts to the setup-session sub-resource and returns the url", async () => {
  apiMock.on("post", async () => ({ data: { url: "https://checkout.stripe.com/cs_1" } }));

  const url = await createCardSetupSession();

  assert.equal(url, "https://checkout.stripe.com/cs_1");
  assert.equal(apiMock.argsFor("post")?.[0], "/api/profile/payment-methods/setup-session");
});

test("confirmSavedCard() posts the setup session id and returns the saved card", async () => {
  apiMock.on("post", async () => ({ data: { item: { id: "pm_1" } } }));

  const card = await confirmSavedCard("cs_1");

  assert.deepEqual(card, { id: "pm_1" });
  assert.deepEqual(apiMock.argsFor("post")?.[1], { setupSessionId: "cs_1" });
});

test("deleteSavedCard() calls DELETE on the resource by id", async () => {
  apiMock.on("delete", async () => ({ data: undefined }));

  await deleteSavedCard("pm_1");

  assert.equal(apiMock.argsFor("delete")?.[0], "/api/profile/payment-methods/pm_1");
});
