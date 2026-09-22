import { NextResponse, type NextRequest } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import {
  createManualExpenseSchema,
  financeListFiltersSchema,
} from "@/modules/finance/schemas/finance.schema";
import { runBatch } from "@/server/db/batch";
import * as financeRepository from "@/server/repositories/finance.repository";

/** Listado de solo lectura del libro de egresos (015 §API). */
export async function GET(request: NextRequest) {
  const check = await requirePermission("finance.view");

  if (!check.ok) {
    return check.response;
  }

  const parsed = financeListFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Filtros inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const expenses = await financeRepository.getExpenseList(parsed.data);

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("GET /api/admin/finance/expenses", error);

    return NextResponse.json(
      { error: "No se pudieron cargar los egresos" },
      { status: 500 },
    );
  }
}

/** Alta de un egreso manual (016 §API). */
export async function POST(request: Request) {
  // Leer no habilita a registrar: `proxy.ts` filtra por ruta y no distingue el
  // método, así que la mutación exige `finance.manage` aquí (AC8).
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

  const parsed = createManualExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { description, ...rest } = parsed.data;

  // El `id` se genera aquí porque `db.batch()` no devuelve filas y la bitácora
  // necesita el `entityId` dentro del mismo batch que el insert.
  const values = {
    id: crypto.randomUUID(),
    ...rest,
    description: description || null,
  };

  try {
    const { ipAddress, userAgent } = getRequestAuditContext(request);

    await runBatch([
      financeRepository.buildManualExpenseInsert({
        ...values,
        createdBy: check.user.id,
      }),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.FINANCE_EXPENSE_CREATED,
        entityType: "finance_expense",
        entityId: values.id,
        // Sin PII: importe, categoría, fecha y el concepto contable que escribe
        // el propio admin. Ningún dato de cliente entra en una fila manual.
        changes: { after: values },
        metadata: { source: "admin_panel" },
        ipAddress,
        userAgent,
      }),
    ]);

    return NextResponse.json(
      { ...values, origin: "manual", orderId: null },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/admin/finance/expenses", error);

    return NextResponse.json(
      { error: "No se pudo registrar el egreso" },
      { status: 500 },
    );
  }
}
