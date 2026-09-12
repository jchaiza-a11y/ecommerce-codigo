import { NextResponse } from "next/server";

import { getCurrentUserState } from "@/lib/auth";
import type { OrderReceiptResponse } from "@/modules/profile/schemas/order-history.schema";
import { orderIdSchema } from "@/modules/profile/schemas/order-history.schema";
import { resolveOrderReceiptUrl } from "@/server/services/order-receipt.service";

const UNAUTHORIZED_MESSAGE = "Necesitas iniciar sesión para ver tu boleta";
const NOT_FOUND_MESSAGE = "No encontramos ese pedido";

/**
 * `context.params` es una `Promise` en Next.js 16: se espera antes de validar.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/orders/[orderId]/receipt">,
) {
  const state = await getCurrentUserState();

  if (state.status !== "ready") {
    return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
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
    const result = await resolveOrderReceiptUrl(state.user.id, parsed.data);

    // 404 y no 403 para el pedido ajeno: un 403 confirmaría que existe (AC8).
    if (result.status === "not_found") {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    if (result.status === "stripe_unavailable") {
      return NextResponse.json(
        { error: "Stripe no respondió. Inténtalo de nuevo en unos momentos." },
        { status: 502 },
      );
    }

    const body: OrderReceiptResponse = { url: result.url };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/orders/[orderId]/receipt", error);

    return NextResponse.json(
      { error: "No se pudo obtener la boleta" },
      { status: 500 },
    );
  }
}
