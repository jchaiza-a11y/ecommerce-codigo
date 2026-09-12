import { NextResponse } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import {
  updateUserSchema,
  userIdSchema,
} from "@/modules/users/schemas/user.schema";
import { runBatch } from "@/server/db/batch";
import * as userRepository from "@/server/repositories/user.repository";

import { USER_NOT_FOUND } from "../_shared";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/users/[id]">,
) {
  const check = await requirePermission("users.view");

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

  try {
    const found = await userRepository.findByIdWithRoles(parsedId.data);

    if (!found) {
      return NextResponse.json({ error: USER_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json(found);
  } catch (error) {
    console.error("GET /api/admin/users/[id]", error);

    return NextResponse.json(
      { error: "No se pudo cargar el usuario" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/users/[id]">,
) {
  const check = await requirePermission("users.update");

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

  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Activar o desactivar una cuenta es un permiso propio: editar el perfil no
  // habilita a dejar a alguien fuera de la aplicación (§6).
  if (parsed.data.isActive !== undefined) {
    const deactivateCheck = await requirePermission("users.deactivate");

    if (!deactivateCheck.ok) {
      return deactivateCheck.response;
    }
  }

  try {
    const existing = await userRepository.findById(parsedId.data);

    if (!existing) {
      return NextResponse.json({ error: USER_NOT_FOUND }, { status: 404 });
    }

    const { firstName, lastName, isActive } = parsed.data;
    const changed = {
      ...(firstName !== undefined && firstName !== existing.firstName
        ? { firstName }
        : {}),
      ...(lastName !== undefined && (lastName ?? null) !== existing.lastName
        ? { lastName: lastName ?? null }
        : {}),
      ...(isActive !== undefined && isActive !== existing.isActive
        ? { isActive }
        : {}),
    };

    if (Object.keys(changed).length === 0) {
      const unchanged = await userRepository.findByIdWithRoles(parsedId.data);

      return NextResponse.json(unchanged);
    }

    const before = Object.fromEntries(
      Object.keys(changed).map((key) => [
        key,
        existing[key as keyof typeof existing],
      ]),
    );
    const { ipAddress, userAgent } = getRequestAuditContext(request);

    // Mutación y bitácora en el mismo `batch`: si el log falla, el cambio
    // revierte con él (CLAUDE.md §4.9, 003 §8.5).
    await runBatch([
      userRepository.buildUpdate(parsedId.data, changed),
      buildAuditLogInsert({
        actorId: check.user.id,
        action:
          changed.isActive !== undefined
            ? AUDIT_ACTIONS.USER_ACTIVATION_CHANGED
            : AUDIT_ACTIONS.USER_UPDATED,
        entityType: "user",
        entityId: existing.id,
        changes: { before, after: changed },
        metadata: { source: "admin_panel" },
        severity: changed.isActive === false ? "warning" : "info",
        ipAddress,
        userAgent,
      }),
    ]);

    const updated = await userRepository.findByIdWithRoles(parsedId.data);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/users/[id]", error);

    return NextResponse.json(
      { error: "No se pudo actualizar el usuario" },
      { status: 500 },
    );
  }
}
