import test from "node:test";
import assert from "node:assert/strict";

import { mockApi } from "@/testing/mocks/axios.mock.ts";

const apiMock = mockApi();
const { createCheckoutSession } = await import("@/modules/checkout/services/checkout.service.ts");

test("createCheckoutSession() posts the input to /api/checkout/session and returns the response", async () => {
  apiMock.on("post", async () => ({ data: { url: "https://checkout.stripe.com/cs_1", orderId: "order_1" } }));

  const input = { items: [{ productId: "prod_1", quantity: 1 }] } as never;
  const result = await createCheckoutSession(input);

  assert.deepEqual(result, { url: "https://checkout.stripe.com/cs_1", orderId: "order_1" });
  assert.equal(apiMock.argsFor("post")?.[0], "/api/checkout/session");
  assert.deepEqual(apiMock.argsFor("post")?.[1], input);
});
