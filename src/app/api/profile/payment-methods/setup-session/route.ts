import { NextResponse } from "next/server";

import type { CardSetupSessionResponse } from "@/modules/profile/schemas/saved-card.schema";
import { setupSessionSchema } from "@/modules/profile/schemas/saved-card.schema";
import { createSetupSession } from "@/server/services/saved-card.service";

import { resolveSavedCardActor } from "../_shared";

/**
 * Abre la página hospedada de Stripe en modo setup (AC2). El usuario sale de la
 * sesión de Clerk y nunca del body: nadie puede pedir una sesión a nombre de
 * otro. El body llega vacío pero se valida igual (CLAUDE.md §4.4).
 */
export async function POST(request: Request) {
  const guard = await resolveSavedCardActor();

  if (guard.status === "denied") {
    return guard.response;
  }

  // Un `POST` sin cuerpo es legítimo aquí: `{}` y "nada" valen lo mismo.
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = setupSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const url = await createSetupSession(guard.actor);
    const responseBody: CardSetupSessionResponse = { url };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("POST /api/profile/payment-methods/setup-session", error);

    return NextResponse.json(
      { error: "No se pudo abrir el formulario de Stripe" },
      { status: 500 },
    );
  }
}
