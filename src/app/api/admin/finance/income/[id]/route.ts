import { NextResponse } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import {
  financeEntryIdSchema,
  updateManualIncomeSchema,
} from "@/modules/finance/schemas/finance.schema";
import { runBatch } from "@/server/db/batch";
import * as financeRepository from "@/server/repositories/finance.repository";
import type { ManualIncomeChanges } from "@/server/repositories/finance.repository";

/**
 * Edición y borrado de un ingreso manual (016 §API).
 *
 * Los ingresos de origen `order` quedan fuera por partida doble: el `find`
 * previo solo ve filas manuales —de ahí el 404 de AC5— y el `WHERE` del
 * `UPDATE`/`DELETE` vuelve a filtrar por `origin = 'manual'`, que es la defensa
 * que no depende de la UI ni de esta lectura.
 */
const NOT_FOUND = "El ingreso manual no existe";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/finance/income/[id]">,
) {
  const check = await requirePermission("finance.manage");

  if (!check.ok) {
    return check.response;
  }

  const { id } = await context.params;
  const parsedId = financeEntryIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: parsedId.error.issues },
      { status: 400 },
    );
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

  const parsed = updateManualIncomeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { description, ...rest } = parsed.data;

  // La descripción ausente deja el campo intacto; vacía lo borra.
  const changes: ManualIncomeChanges = {
    ...rest,
    ...(description !== undefined ? { description: description || null } : {}),
  };

  try {
    const existing = await financeRepository.findManualIncomeById(
      parsedId.data,
    );

    if (!existing) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    const { ipAddress, userAgent } = getRequestAuditContext(request);

    await runBatch([
      financeRepository.buildManualIncomeUpdate(parsedId.data, changes),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.FINANCE_INCOME_UPDATED,
        entityType: "finance_income",
        entityId: existing.id,
        changes: { before: existing, after: changes },
        metadata: { source: "admin_panel" },
        ipAddress,
        userAgent,
      }),
    ]);

    return NextResponse.json({
      ...existing,
      ...changes,
      origin: "manual",
      orderId: null,
    });
  } catch (error) {
    console.error("PATCH /api/admin/finance/income/[id]", error);

    return NextResponse.json(
      { error: "No se pudo actualizar el ingreso" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/admin/finance/income/[id]">,
) {
  const check = await requirePermission("finance.manage");

  if (!check.ok) {
    return check.response;
  }

  const { id } = await context.params;
  const parsedId = financeEntryIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: parsedId.error.issues },
      { status: 400 },
    );
  }

  try {
    const existing = await financeRepository.findManualIncomeById(
      parsedId.data,
    );

    if (!existing) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    const { ipAddress, userAgent } = getRequestAuditContext(request);

    await runBatch([
      financeRepository.buildManualIncomeDelete(parsedId.data),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.FINANCE_INCOME_DELETED,
        entityType: "finance_income",
        entityId: existing.id,
        // La fila desaparece del ledger: sin el `before` la bitácora no diría
        // qué importe dejó de contar en el resumen.
        changes: { before: existing },
        metadata: { source: "admin_panel" },
        ipAddress,
        userAgent,
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/admin/finance/income/[id]", error);

    return NextResponse.json(
      { error: "No se pudo eliminar el ingreso" },
      { status: 500 },
    );
  }
}
