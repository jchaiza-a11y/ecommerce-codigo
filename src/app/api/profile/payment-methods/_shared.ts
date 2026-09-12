import { NextResponse } from "next/server";

import { getCurrentUserState } from "@/lib/auth";
import { UNSYNCED_MESSAGE } from "@/lib/permissions";
import type { SavedCardActor } from "@/server/services/saved-card.service";

export const CARD_NOT_FOUND_MESSAGE = "No encontramos esa tarjeta";
export const STRIPE_UNAVAILABLE_MESSAGE =
  "Stripe no respondió. Inténtalo de nuevo en unos momentos.";

export type SavedCardActorResult =
  | { status: "ready"; actor: SavedCardActor }
  | { status: "denied"; response: NextResponse };

/**
 * Puerta de los tres endpoints de tarjetas. Es el mismo bloque de autoservicio
 * de `/api/checkout/session` (AC8): sesión obligatoria y ningún
 * `permission.code`, porque gestionar los propios medios de pago es algo que
 * cualquier cliente autenticado puede hacer; los permisos gobiernan el panel.
 *
 * Se extrae aquí y no se copia en cada handler porque son tres consumidores con
 * exactamente el mismo contrato de error.
 */
export async function resolveSavedCardActor(): Promise<SavedCardActorResult> {
  const state = await getCurrentUserState();

  if (state.status === "anonymous") {
    return {
      status: "denied",
      response: NextResponse.json(
        { error: "Necesitas iniciar sesión para gestionar tus tarjetas" },
        { status: 401 },
      ),
    };
  }

  // Sin fila en `users` no hay `payment_methods.user_id` posible: es un fallo
  // de sincronización, no de permisos, y se dice como tal (003 §11).
  if (state.status === "unsynced") {
    return {
      status: "denied",
      response: NextResponse.json({ error: UNSYNCED_MESSAGE }, { status: 403 }),
    };
  }

  if (!state.user.isActive) {
    return {
      status: "denied",
      response: NextResponse.json(
        { error: "Tu cuenta está desactivada" },
        { status: 403 },
      ),
    };
  }

  return {
    status: "ready",
    actor: { id: state.user.id, email: state.user.email },
  };
}
