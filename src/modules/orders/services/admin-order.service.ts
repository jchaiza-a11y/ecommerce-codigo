import { api } from "@/lib/axios";
import type { AdminOrderQuery } from "@/modules/orders/constants";
import type {
  AdminOrderDetail,
  AdminOrderListResponse,
} from "@/modules/orders/schemas/admin-order.schema";
import type { OrderReceiptResponse } from "@/modules/profile/schemas/order-history.schema";

const RESOURCE = "/api/admin/orders";

/**
 * Los filtros vacíos no viajan. No es cosmético: `adminOrderFiltersSchema`
 * rechaza `customer=""` con un 400 a propósito (no lleva `.catch()` como la
 * bitácora), así que mandar el campo recién limpiado rompería el listado.
 */
function toQueryParams(query: AdminOrderQuery): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.trim().length > 0) {
      params[key] = value;
    }
  }

  return params;
}

export async function getAdminOrders(
  query: AdminOrderQuery,
): Promise<AdminOrderListResponse> {
  const { data } = await api.get<AdminOrderListResponse>(RESOURCE, {
    params: toQueryParams(query),
  });

  return data;
}

/** El desglose de líneas se pide al abrir el diálogo (§Decisiones 4). */
export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetail> {
  const { data } = await api.get<AdminOrderDetail>(`${RESOURCE}/${orderId}`);

  return data;
}

export async function getAdminOrderReceipt(
  orderId: string,
): Promise<OrderReceiptResponse> {
  const { data } = await api.get<OrderReceiptResponse>(
    `${RESOURCE}/${orderId}/receipt`,
  );

  return data;
}
