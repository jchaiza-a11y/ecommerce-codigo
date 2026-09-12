import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserState } from "@/lib/auth";
import type {
  OrderHistoryItem,
  OrderHistoryResponse,
} from "@/modules/profile/schemas/order-history.schema";
import { orderHistoryQuerySchema } from "@/modules/profile/schemas/order-history.schema";
import type { OrderWithItems } from "@/server/repositories/order.repository";
import * as orderRepository from "@/server/repositories/order.repository";

const UNAUTHORIZED_MESSAGE = "Necesitas iniciar sesión para ver tus compras";

/** El `stripe_payment_intent_id` es dato interno y no sale en la respuesta. */
function toOrderHistoryItem(row: OrderWithItems): OrderHistoryItem {
  return {
    id: row.id,
    status: row.status,
    totalCents: row.totalCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
  };
}

/**
 * Autoservicio: exige sesión pero ningún `permission.code`. Un usuario sin fila
 * en `users` tampoco puede tener pedidos, así que también es 401 (AC9): aquí no
 * hay nada que sincronizar todavía.
 */
export async function GET(request: NextRequest) {
  const state = await getCurrentUserState();

  if (state.status !== "ready") {
    return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
  }

  const parsed = orderHistoryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    // El primer `issue` va como `error` para que la UI pueda decir *por qué* se
    // rechazó el rango en vez de un genérico (AC3).
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Rango de fechas inválido",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const rows = await orderRepository.findHistoryByUserId({
      userId: state.user.id,
      from: new Date(parsed.data.from),
      to: new Date(parsed.data.to),
    });

    const body: OrderHistoryResponse = { items: rows.map(toOrderHistoryItem) };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/orders", error);

    return NextResponse.json(
      { error: "No se pudo cargar tu historial de compras" },
      { status: 500 },
    );
  }
}
