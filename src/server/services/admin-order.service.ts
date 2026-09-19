import "server-only";

import type { AdminOrderDetail } from "@/modules/orders/schemas/admin-order.schema";
import { toAdminOrderCustomer } from "@/modules/orders/schemas/admin-order.schema";
import * as orderRepository from "@/server/repositories/order.repository";
import * as userRepository from "@/server/repositories/user.repository";

/**
 * Detalle de un pedido para el panel: cabecera, cliente y líneas.
 *
 * No hay comprobación de dueño —eso lo cubre `orders.view` en el handler— y el
 * total sale de `orders.total_cents` tal cual, sin recalcularse desde las
 * líneas: es el importe congelado que se cobró (AC9).
 */
export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetail | null> {
  const found = await orderRepository.findWithItems(orderId);

  if (!found) {
    return null;
  }

  const customer = await userRepository.findById(found.userId);

  // `orders.user_id` es notNull con FK: que no resuelva es una inconsistencia
  // de datos, no un 404. Se propaga para que el handler devuelva 500.
  if (!customer) {
    throw new Error(
      `El pedido ${orderId} referencia al usuario ${found.userId}, que no existe`,
    );
  }

  return {
    id: found.id,
    createdAt: found.createdAt.toISOString(),
    status: found.status,
    totalCents: found.totalCents,
    currency: found.currency,
    customer: toAdminOrderCustomer(customer),
    items: found.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
  };
}
