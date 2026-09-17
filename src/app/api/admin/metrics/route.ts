import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { getDashboardMetrics } from "@/server/services/dashboard.service";

/**
 * Métricas del dashboard de administración (011 §API).
 *
 * Sin validación Zod a propósito: el endpoint no acepta query params ni body
 * porque la ventana es fija de 30 días, así que no hay entrada que validar
 * (011 §API; no incumple CLAUDE.md §4.4).
 */
export async function GET() {
  const check = await requirePermission("dashboard.view");

  if (!check.ok) {
    return check.response;
  }

  try {
    const metrics = await getDashboardMetrics();

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("GET /api/admin/metrics", error);

    return NextResponse.json(
      { error: "No se pudieron cargar las métricas" },
      { status: 500 },
    );
  }
}
