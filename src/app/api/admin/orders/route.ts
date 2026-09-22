import { NextResponse, type NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions";
import {
  ADMIN_ORDER_LIMIT,
  adminOrderFiltersSchema,
  resolveAdminOrderRange,
  type AdminOrderListResponse,
} from "@/modules/orders/schemas/admin-order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

export async function GET(request: NextRequest) {
  const check = await requirePermission("orders.view");

  if (!check.ok) {
    return check.response;
  }

  const parsed = adminOrderFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Filtros inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { from, to } = resolveAdminOrderRange(parsed.data);

  try {
    const rows = await orderRepository.findAdminOrders({
      from,
      to,
      status: parsed.data.status,
      customer: parsed.data.customer,
    });

    const body: AdminOrderListResponse = {
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        status: row.status,
        totalCents: row.totalCents,
        currency: row.currency,
        itemCount: row.itemCount,
        customer: row.customer,
      })),
      // Alcanzar el tope no prueba que falten pedidos, pero sí que pueden
      // faltar: la UI pide acotar el periodo en vez de mentir (AC8).
      truncated: rows.length === ADMIN_ORDER_LIMIT,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/admin/orders", error);

    return NextResponse.json(
      { error: "No se pudieron cargar los pedidos" },
      { status: 500 },
    );
  }
}
