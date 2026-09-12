import { api } from "@/lib/axios";
import type {
  CheckoutSessionInput,
  CheckoutSessionResponse,
} from "@/modules/checkout/schemas/checkout.schema";

const RESOURCE = "/api/checkout/session";

export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSessionResponse> {
  const { data } = await api.post<CheckoutSessionResponse>(RESOURCE, input);

  return data;
}
