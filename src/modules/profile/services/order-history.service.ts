import { api } from "@/lib/axios";
import type {
  OrderHistoryItem,
  OrderHistoryQuery,
  OrderHistoryResponse,
  OrderReceiptResponse,
} from "@/modules/profile/schemas/order-history.schema";

const RESOURCE = "/api/orders";

/** Historial de pedidos pagados del usuario en sesión dentro de `[from, to)`. */
export async function getOrderHistory(
  range: OrderHistoryQuery,
): Promise<OrderHistoryItem[]> {
  const { data } = await api.get<OrderHistoryResponse>(RESOURCE, {
    params: range,
  });

  return data.items;
}

export async function getOrderReceipt(
  orderId: string,
): Promise<OrderReceiptResponse> {
  const { data } = await api.get<OrderReceiptResponse>(
    `${RESOURCE}/${orderId}/receipt`,
  );

  return data;
}
