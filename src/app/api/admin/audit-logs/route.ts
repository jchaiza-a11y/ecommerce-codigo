import { NextResponse, type NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { auditLogFiltersSchema } from "@/modules/audit-logs/schemas/audit-log.schema";
import * as auditLogRepository from "@/server/repositories/audit-log.repository";

export async function GET(request: NextRequest) {
  const check = await requirePermission("audit_logs.view");

  if (!check.ok) {
    return check.response;
  }

  const parsed = auditLogFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Filtros inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const logs = await auditLogRepository.findMany(parsed.data);

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET /api/admin/audit-logs", error);

    return NextResponse.json(
      { error: "No se pudo cargar la bitácora" },
      { status: 500 },
    );
  }
}
