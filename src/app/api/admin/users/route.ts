import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { createUserSchema } from "@/modules/users/schemas/user.schema";
import { runBatch } from "@/server/db/batch";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";
import * as userRoleRepository from "@/server/repositories/user-role.repository";
import { syncClerkAccessMetadata } from "@/server/services/user-access.service";

import {
  checkRoleHierarchy,
  EMAIL_TAKEN,
  generateTemporaryPassword,
  UNKNOWN_ROLE,
} from "./_shared";

const CLERK_IDENTIFIER_TAKEN = "form_identifier_exists";

export async function GET() {
  const check = await requirePermission("users.view");

  if (!check.ok) {
    return check.response;
  }

  try {
    const users = await userRepository.findAllWithRoles();

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/admin/users", error);

    return NextResponse.json(
      { error: "No se pudieron cargar los usuarios" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const check = await requirePermission("users.create");

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

  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { email, firstName, lastName, roleSlugs } = parsed.data;

  const hierarchyError = checkRoleHierarchy(check.user, roleSlugs);

  if (hierarchyError) {
    return hierarchyError;
  }

  try {
    const roles = await roleRepository.findBySlugs(roleSlugs);

    if (roles.length !== new Set(roleSlugs).size) {
      return NextResponse.json({ error: UNKNOWN_ROLE }, { status: 400 });
    }

    if (await userRepository.findByEmail(email)) {
      return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
    }

    // La contraseña temporal solo vive en esta variable y en la respuesta:
    // nunca se persiste, ni se registra en `audit_logs`, ni se loguea (§8.4).
    const temporaryPassword = generateTemporaryPassword();
    const client = await clerkClient();

    const clerkUser = await client.users.createUser({
      emailAddress: [email],
      password: temporaryPassword,
      firstName,
      lastName: lastName ?? undefined,
      publicMetadata: {
        // Red de seguridad: si este handler fallara tras crear la cuenta, el
        // webhook `user.created` aplicaría igualmente estos roles (§8.4).
        pendingRoles: roleSlugs,
        mustChangePassword: true,
      },
    });

    // El webhook puede haberse adelantado: si ya creó la fila, se reutiliza su
    // id en vez de generar otro que rompería la FK de `user_roles` (§8.5).
    const existing = await userRepository.findByClerkId(clerkUser.id);
    const userId = existing?.id ?? crypto.randomUUID();
    const { ipAddress, userAgent } = getRequestAuditContext(request);

    await runBatch([
      userRepository.buildUpsertByClerkId({
        id: userId,
        clerkId: clerkUser.id,
        email,
        firstName,
        lastName: lastName ?? null,
        imageUrl: clerkUser.imageUrl || null,
      }),
      ...userRoleRepository.buildInsertForUser(
        userId,
        roles.map((role) => role.id),
        check.user.id,
      ),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: "user",
        entityId: userId,
        changes: {
          after: {
            email,
            firstName,
            lastName: lastName ?? null,
            roles: roles.map((role) => role.slug),
          },
        },
        metadata: { source: "admin_panel" },
        ipAddress,
        userAgent,
      }),
    ]);

    await syncClerkAccessMetadata(clerkUser.id);

    const created = await userRepository.findByIdWithRoles(userId);

    return NextResponse.json(
      { user: created, temporaryPassword },
      { status: 201 },
    );
  } catch (error) {
    if (
      isClerkAPIResponseError(error) &&
      error.errors.some((issue) => issue.code === CLERK_IDENTIFIER_TAKEN)
    ) {
      return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
    }

    if (userRepository.isUniqueViolation(error)) {
      return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
    }

    console.error("POST /api/admin/users", error);

    return NextResponse.json(
      { error: "No se pudo crear el usuario" },
      { status: 500 },
    );
  }
}
