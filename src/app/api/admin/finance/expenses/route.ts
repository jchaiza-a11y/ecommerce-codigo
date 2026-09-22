import { NextResponse, type NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { financeListFiltersSchema } from "@/modules/finance/schemas/finance.schema";
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
