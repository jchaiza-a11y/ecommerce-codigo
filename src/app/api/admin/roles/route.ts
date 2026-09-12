import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import * as roleRepository from "@/server/repositories/role.repository";

/** Catálogo de solo lectura: los seis roles son de sistema (003 §8.10). */
export async function GET() {
  const check = await requirePermission("roles.view");

  if (!check.ok) {
    return check.response;
  }

  try {
    const roles = await roleRepository.findAllWithPermissions();

    return NextResponse.json(roles);
  } catch (error) {
    console.error("GET /api/admin/roles", error);

    return NextResponse.json(
      { error: "No se pudieron cargar los roles" },
      { status: 500 },
    );
  }
}
