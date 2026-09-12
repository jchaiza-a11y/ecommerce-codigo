import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import {
  AUDIT_ACTIONS,
  getRequestAuditContext,
  recordAuditLog,
} from "@/lib/audit";
import { getCurrentUserState } from "@/lib/auth";

const UNAUTHENTICATED_MESSAGE = "Necesitas iniciar sesión";

/**
 * Cierra el ciclo del alta por contraseña temporal (003 §8.4, AC8): limpia
 * `publicMetadata.mustChangePassword` para que `proxy.ts` deje de encerrar al
 * usuario en `/profile`.
 *
 * Es **autoservicio sobre la propia cuenta**, así que no exige ningún
 * `permission.code`: no es una acción sobre otro recurso, sino el propio
 * usuario confirmando su propio cambio. Basta con la sesión de Clerk, y el
 * `clerkId` sale de ella —nunca del cuerpo de la petición—, de modo que nadie
 * puede limpiar el flag de un tercero.
 *
 * Es una confirmación explícita y no una detección automática a propósito: el
 * payload de `user.updated` de Clerk no distingue un cambio de contraseña de
 * cualquier otra edición de perfil, y `syncClerkAccessMetadata()` genera sus
 * propios `user.updated`, con lo que un webhook borraría el flag recién puesto.
 */
export async function POST(request: Request) {
  const state = await getCurrentUserState();

  if (state.status === "anonymous") {
    return NextResponse.json(
      { error: UNAUTHENTICATED_MESSAGE },
      { status: 401 },
    );
  }

  const clerkId =
    state.status === "ready" ? state.user.clerkId : state.clerkId;

  try {
    const client = await clerkClient();

    // `updateUserMetadata` hace merge profundo: solo se toca esta clave,
    // `roles`, `permissions` y `pendingRoles` quedan intactos.
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: { mustChangePassword: false },
    });

    // La mutación vive en Clerk, no en Postgres, así que no hay `batch` al que
    // sumarse: este es justo el caso no transaccional de `recordAuditLog`
    // (003 §8.5). Sin fila en `users` no hay `actor_id` que registrar, y el
    // evento se omite antes que inventar un actor.
    if (state.status === "ready") {
      const { ipAddress, userAgent } = getRequestAuditContext(request);

      await recordAuditLog({
        actorId: state.user.id,
        action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE_CONFIRMED,
        entityType: "user",
        entityId: state.user.id,
        changes: {
          before: { mustChangePassword: true },
          after: { mustChangePassword: false },
        },
        metadata: { source: "profile" },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({ mustChangePassword: false });
  } catch (error) {
    console.error("POST /api/profile/password-changed", error);

    return NextResponse.json(
      { error: "No se pudo confirmar el cambio de contraseña" },
      { status: 500 },
    );
  }
}
