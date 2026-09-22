import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { orderIdSchema } from "@/modules/profile/schemas/order-history.schema";
import { getAdminOrderDetail } from "@/server/services/admin-order.service";

const NOT_FOUND_MESSAGE = "No encontramos ese pedido";

/** `context.params` es una `Promise` en Next.js 16: se espera antes de validar. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/orders/[orderId]">,
) {
  const check = await requirePermission("orders.view");

  if (!check.ok) {
    return check.response;
  }

  const { orderId } = await context.params;
  const parsed = orderIdSchema.safeParse(orderId);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Identificador de pedido inválido", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const detail = await getAdminOrderDetail(parsed.data);

    if (!detail) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("GET /api/admin/orders/[orderId]", error);

    return NextResponse.json(
      { error: "No se pudo cargar el pedido" },
      { status: 500 },
    );
  }
}
