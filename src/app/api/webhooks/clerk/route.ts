import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import { AUDIT_ACTIONS, buildAuditLogInsert } from "@/lib/audit";
import { runBatch, type PgStatement } from "@/server/db/batch";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";
import * as userRoleRepository from "@/server/repositories/user-role.repository";
import { syncClerkAccessMetadata } from "@/server/services/user-access.service";

const DEFAULT_ROLE_SLUG = "customer";
const BOOTSTRAP_ROLE_SLUG = "super_admin";

// Los tipos del payload se derivan del propio `verifyWebhook` en vez de
// importarse por nombre: así siguen a la versión instalada de Clerk sin
// duplicar su modelo (CLAUDE.md §6, tipos inferidos).
type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;
type UserEventData = Extract<
  ClerkWebhookEvent,
  { type: "user.created" | "user.updated" }
>["data"];
type DeletedEventData = Extract<
  ClerkWebhookEvent,
  { type: "user.deleted" }
>["data"];

function getPrimaryEmail(data: UserEventData): string | null {
  const primary = data.email_addresses.find(
    (address) => address.id === data.primary_email_address_id,
  );

  return (
    primary?.email_address ?? data.email_addresses[0]?.email_address ?? null
  );
}

function toUserColumns(data: UserEventData, email: string) {
  return {
    clerkId: data.id,
    email,
    firstName: data.first_name,
    lastName: data.last_name,
    imageUrl: data.image_url || null,
  };
}

/**
 * Roles iniciales (§8.4 y §8.6), en este orden:
 * 1. `pendingRoles`: el alta vino del panel y ya trae sus roles elegidos.
 * 2. Bootstrap: no existe todavía ningún `super_admin` y el email coincide con
 *    `ADMIN_BOOTSTRAP_EMAIL`. En cuanto hay uno, esta rama queda muerta.
 * 3. `customer`: el default de un registro público (SETUP.md §5.1 regla 3).
 */
async function resolveInitialRoleSlugs(
  data: UserEventData,
  email: string,
): Promise<string[]> {
  const pending = data.public_metadata.pendingRoles;

  if (Array.isArray(pending) && pending.length > 0) {
    return pending;
  }

  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();

  if (
    bootstrapEmail &&
    bootstrapEmail.toLowerCase() === email.toLowerCase() &&
    !(await roleRepository.existsUserWithRoleSlug(BOOTSTRAP_ROLE_SLUG))
  ) {
    return [BOOTSTRAP_ROLE_SLUG];
  }

  return [DEFAULT_ROLE_SLUG];
}

async function handleUserCreated(data: UserEventData): Promise<NextResponse> {
  const email = getPrimaryEmail(data);

  if (!email) {
    console.error("clerk webhook user.created sin email", { clerkId: data.id });

    return NextResponse.json(
      { error: "El evento no incluye ninguna dirección de correo" },
      { status: 400 },
    );
  }

  const existing = await userRepository.findByClerkId(data.id);

  if (existing) {
    // El alta ya se provisionó desde el panel, que dejó su propia fila en
    // `audit_logs` (`user.created`). Reauditar aquí duplicaría el registro de
    // una única mutación (AC10); basta con refrescar el caché de permisos.
    await syncClerkAccessMetadata(data.id);

    return NextResponse.json({ received: true });
  }

  // El id se genera en la app: dentro de un `batch` no se puede alimentar una
  // sentencia con el `returning()` de otra (§8.5).
  const userId = crypto.randomUUID();

  const roleSlugs = await resolveInitialRoleSlugs(data, email);
  const roles = await roleRepository.findBySlugs(roleSlugs);

  if (roles.length !== roleSlugs.length) {
    console.error("clerk webhook user.created con roles inexistentes", {
      clerkId: data.id,
      roleSlugs,
    });

    return NextResponse.json(
      { error: "Alguno de los roles solicitados no existe" },
      { status: 400 },
    );
  }

  await runBatch([
    userRepository.buildUpsertByClerkId({
      id: userId,
      ...toUserColumns(data, email),
    }),
    ...userRoleRepository.buildInsertForUser(
      userId,
      roles.map((role) => role.id),
      null,
    ),
    buildAuditLogInsert({
      actorId: null,
      action: AUDIT_ACTIONS.USER_AUTO_PROVISIONED,
      entityType: "user",
      entityId: userId,
      changes: { after: { email, roles: roles.map((role) => role.slug) } },
      metadata: { source: "clerk_webhook" },
    }),
  ]);

  await syncClerkAccessMetadata(data.id);

  return NextResponse.json({ received: true });
}

async function handleUserUpdated(data: UserEventData): Promise<NextResponse> {
  const email = getPrimaryEmail(data);

  if (!email) {
    console.error("clerk webhook user.updated sin email", { clerkId: data.id });

    return NextResponse.json(
      { error: "El evento no incluye ninguna dirección de correo" },
      { status: 400 },
    );
  }

  const existing = await userRepository.findByClerkId(data.id);

  if (!existing) {
    // Llegó un `updated` de un usuario que nunca se sincronizó (webhook dado de
    // alta tarde, §11): se provisiona ahora en vez de perderlo.
    return handleUserCreated(data);
  }

  const next = toUserColumns(data, email);
  const changed = {
    ...(next.email !== existing.email ? { email: next.email } : {}),
    ...(next.firstName !== existing.firstName
      ? { firstName: next.firstName }
      : {}),
    ...(next.lastName !== existing.lastName ? { lastName: next.lastName } : {}),
    ...(next.imageUrl !== existing.imageUrl ? { imageUrl: next.imageUrl } : {}),
  };

  // Sin cambios en nuestras columnas no hay nada que auditar: cada refresco de
  // `publicMetadata` dispara un `user.updated` y llenaría la bitácora de ruido.
  if (Object.keys(changed).length === 0) {
    return NextResponse.json({ received: true });
  }

  const before = Object.fromEntries(
    Object.keys(changed).map((key) => [
      key,
      existing[key as keyof typeof existing],
    ]),
  );

  await runBatch([
    userRepository.buildUpdate(existing.id, changed),
    buildAuditLogInsert({
      actorId: null,
      action: AUDIT_ACTIONS.USER_SYNCED,
      entityType: "user",
      entityId: existing.id,
      changes: { before, after: changed },
      metadata: { source: "clerk_webhook" },
    }),
  ]);

  return NextResponse.json({ received: true });
}

async function handleUserDeleted(
  data: DeletedEventData,
): Promise<NextResponse> {
  const clerkId = data.id;

  if (!clerkId) {
    return NextResponse.json({ received: true });
  }

  const existing = await userRepository.findByClerkId(clerkId);

  if (!existing || !existing.isActive) {
    return NextResponse.json({ received: true });
  }

  // Baja lógica: la fila sobrevive porque `audit_logs.actor_id` la referencia.
  const statements: PgStatement[] = [
    userRepository.buildDeactivateByClerkId(clerkId),
    buildAuditLogInsert({
      actorId: null,
      action: AUDIT_ACTIONS.USER_DEACTIVATED_BY_CLERK,
      entityType: "user",
      entityId: existing.id,
      changes: { before: { isActive: true }, after: { isActive: false } },
      metadata: { source: "clerk_webhook" },
      severity: "warning",
    }),
  ];

  await runBatch(statements);

  return NextResponse.json({ received: true });
}

export async function POST(request: NextRequest) {
  let event;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("POST /api/webhooks/clerk — firma inválida", error);

    return NextResponse.json(
      { error: "Firma del webhook inválida" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "user.created":
        return await handleUserCreated(event.data);
      case "user.updated":
        return await handleUserUpdated(event.data);
      case "user.deleted":
        return await handleUserDeleted(event.data);
      default:
        // Evento no suscrito: se acusa recibo para que Clerk no reintente.
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error(`POST /api/webhooks/clerk — ${event.type}`, error);

    return NextResponse.json(
      { error: "No se pudo procesar el evento" },
      { status: 500 },
    );
  }
}
