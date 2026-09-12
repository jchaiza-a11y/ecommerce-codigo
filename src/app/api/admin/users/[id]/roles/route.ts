import { NextResponse } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import {
  assignRolesSchema,
  userIdSchema,
} from "@/modules/users/schemas/user.schema";
import { runBatch } from "@/server/db/batch";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";
import * as userRoleRepository from "@/server/repositories/user-role.repository";
import { syncClerkAccessMetadata } from "@/server/services/user-access.service";

import { checkRoleHierarchy, UNKNOWN_ROLE, USER_NOT_FOUND } from "../../_shared";

export async function PUT(
  request: Request,
  context: RouteContext<"/api/admin/users/[id]/roles">,
) {
  const check = await requirePermission("users.assign_roles");

  if (!check.ok) {
    return check.response;
  }

  const { id } = await context.params;
  const parsedId = userIdSchema.safeParse(id);

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

  const parsed = assignRolesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const requestedSlugs = [...new Set(parsed.data.roleSlugs)];

  try {
    const target = await userRepository.findById(parsedId.data);

    if (!target) {
      return NextResponse.json({ error: USER_NOT_FOUND }, { status: 404 });
    }

    // Lectura previa al batch (§8.5): con `neon-http` no se puede leer dentro
    // de la transacción, y el `before` de la bitácora la necesita.
    const currentRoles = await userRoleRepository.findByUserId(target.id);
    const currentSlugs = currentRoles.map((role) => role.slug);

    const hierarchyError = checkRoleHierarchy(
      check.user,
      requestedSlugs,
      currentSlugs,
    );

    if (hierarchyError) {
      return hierarchyError;
    }

    const roles = await roleRepository.findBySlugs(requestedSlugs);

    if (roles.length !== requestedSlugs.length) {
      return NextResponse.json({ error: UNKNOWN_ROLE }, { status: 400 });
    }

    const nextSlugs = roles.map((role) => role.slug).sort();
    const { ipAddress, userAgent } = getRequestAuditContext(request);

    await runBatch([
      ...userRoleRepository.buildReplaceForUser(
        target.id,
        roles.map((role) => role.id),
        check.user.id,
      ),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.ROLES_ASSIGNED,
        entityType: "user",
        entityId: target.id,
        changes: {
          before: { roles: [...currentSlugs].sort() },
          after: { roles: nextSlugs },
        },
        metadata: { source: "admin_panel" },
        // Todo cambio de acceso es material para la auditoría, aunque no sea
        // un fallo (SETUP.md §5.2 regla 4).
        severity: "warning",
        ipAddress,
        userAgent,
      }),
    ]);

    // El caché del JWT queda obsoleto hasta el próximo refresh de token; las
    // mutaciones ya fallan con 403 porque el handler consulta Postgres (AC11).
    await syncClerkAccessMetadata(target.clerkId);

    const updated = await userRepository.findByIdWithRoles(target.id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/admin/users/[id]/roles", error);

    return NextResponse.json(
      { error: "No se pudieron asignar los roles" },
      { status: 500 },
    );
  }
}
