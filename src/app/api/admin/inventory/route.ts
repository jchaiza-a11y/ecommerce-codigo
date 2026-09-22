import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import * as productRepository from "@/server/repositories/product.repository";

/**
 * Listado de inventario (013 §API).
 *
 * Endpoint propio y no `GET /api/products`: aquel es público —sirve al
 * storefront—, devuelve la fila completa y no ordena por stock
 * (013 §Decisiones 7). Sin validación Zod porque no acepta query params ni
 * body: el filtro "solo stock bajo" es client-side (§Decisiones 8).
 */
export async function GET() {
  const check = await requirePermission("products.view");

  if (!check.ok) {
    return check.response;
  }

  try {
    const items = await productRepository.findInventory();

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/admin/inventory", error);

    return NextResponse.json(
      { error: "No se pudo cargar el inventario" },
      { status: 500 },
    );
  }
}
