import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import type { OrderReceiptResponse } from "@/modules/profile/schemas/order-history.schema";
import { orderIdSchema } from "@/modules/profile/schemas/order-history.schema";
import { resolveAdminOrderReceiptUrl } from "@/server/services/order-receipt.service";

const NOT_FOUND_MESSAGE = "Ese pedido no tiene boleta";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/orders/[orderId]/receipt">,
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
    const result = await resolveAdminOrderReceiptUrl(parsed.data);

    // Un pedido inexistente y uno sin pagar comparten respuesta: ninguno tiene
    // boleta que enseñar.
    if (result.status === "not_found") {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    // 502 y no 500: el que no respondió es Stripe, no esta aplicación.
    if (result.status === "stripe_unavailable") {
      return NextResponse.json(
        { error: "Stripe no respondió. Inténtalo de nuevo en unos momentos." },
        { status: 502 },
      );
    }

    const body: OrderReceiptResponse = { url: result.url };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/admin/orders/[orderId]/receipt", error);

    return NextResponse.json(
      { error: "No se pudo obtener la boleta" },
      { status: 500 },
    );
  }
}
