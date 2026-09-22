import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { getFinanceSummary } from "@/server/services/finance-summary.service";

/**
 * Resumen financiero de los últimos 30 días (015 §API).
 *
 * Sin validación Zod a propósito: el endpoint no acepta query params ni body
 * porque la ventana es fija, así que no hay entrada que validar (no incumple
 * CLAUDE.md §4.4, mismo caso que `/api/admin/metrics`).
 */
export async function GET() {
  const check = await requirePermission("finance.view");

  if (!check.ok) {
    return check.response;
  }

  try {
    const summary = await getFinanceSummary();

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/admin/finance/summary", error);

    return NextResponse.json(
      { error: "No se pudo cargar el resumen financiero" },
      { status: 500 },
    );
  }
}
