import { NextResponse } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { updateSettingsSchema } from "@/modules/finance/schemas/finance.schema";
import { runBatch } from "@/server/db/batch";
import * as financeRepository from "@/server/repositories/finance.repository";

/**
 * Configuración global de Finanzas (014 §API). Sin validación Zod en el `GET`:
 * el endpoint no acepta query params ni body, así que no hay entrada que
 * validar (no incumple CLAUDE.md §4.4).
 */
export async function GET() {
  const check = await requirePermission("finance.view");

  if (!check.ok) {
    return check.response;
  }

  try {
    return NextResponse.json(await financeRepository.getSettings());
  } catch (error) {
    console.error("GET /api/admin/finance/settings", error);

    return NextResponse.json(
      { error: "No se pudo cargar la configuración de Finanzas" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  // Leer no habilita a editar: la mutación exige `finance.manage`, que
  // `proxy.ts` no puede resolver por ruta al no distinguir el método (AC5).
  const check = await requirePermission("finance.manage");

  if (!check.ok) {
    return check.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la petición no es JSON válido" },
      { status: 400 },
    );
  }

  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { shippingCostCents } = parsed.data;

  try {
    const before = await financeRepository.getSettings();

    if (before.shippingCostCents === shippingCostCents) {
      return NextResponse.json(before);
    }

    const { ipAddress, userAgent } = getRequestAuditContext(request);

    // Mutación y bitácora en el mismo `batch`: si el log falla, el cambio
    // revierte con él (CLAUDE.md §4.9, AC6).
    await runBatch([
      financeRepository.buildUpdateSettings(shippingCostCents),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.FINANCE_SETTINGS_UPDATED,
        entityType: "finance_settings",
        entityId: String(financeRepository.FINANCE_SETTINGS_ID),
        changes: { before, after: { shippingCostCents } },
        // Sin PII: importes y origen de la acción, nada del actor más allá del
        // `actorId` que ya es la clave de la traza.
        metadata: { source: "admin_panel" },
        ipAddress,
        userAgent,
      }),
    ]);

    return NextResponse.json({ shippingCostCents });
  } catch (error) {
    console.error("PATCH /api/admin/finance/settings", error);

    return NextResponse.json(
      { error: "No se pudo actualizar la configuración de Finanzas" },
      { status: 500 },
    );
  }
}
