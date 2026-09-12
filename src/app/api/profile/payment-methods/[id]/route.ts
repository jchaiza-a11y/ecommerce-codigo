import { NextResponse } from "next/server";

import { savedCardIdSchema } from "@/modules/profile/schemas/saved-card.schema";
import { removeSavedCard } from "@/server/services/saved-card.service";

import {
  CARD_NOT_FOUND_MESSAGE,
  resolveSavedCardActor,
  STRIPE_UNAVAILABLE_MESSAGE,
} from "../_shared";

/**
 * `context.params` es una `Promise` en Next.js 16: se espera antes de validar.
 * La tarjeta de otro usuario responde 404, no 403: un 403 confirmaría que
 * existe, y su fila no se toca (AC7).
 */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/profile/payment-methods/[id]">,
) {
  const guard = await resolveSavedCardActor();

  if (guard.status === "denied") {
    return guard.response;
  }

  const { id } = await context.params;
  const parsed = savedCardIdSchema.safeParse(id);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Identificador de tarjeta inválido",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result = await removeSavedCard(guard.actor.id, parsed.data);

    if (result.status === "not_found") {
      return NextResponse.json(
        { error: CARD_NOT_FOUND_MESSAGE },
        { status: 404 },
      );
    }

    // El detach falló: la fila sigue viva a propósito (010 §Notas).
    if (result.status === "stripe_unavailable") {
      return NextResponse.json(
        { error: STRIPE_UNAVAILABLE_MESSAGE },
        { status: 502 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/profile/payment-methods/[id]", error);

    return NextResponse.json(
      { error: "No se pudo eliminar la tarjeta" },
      { status: 500 },
    );
  }
}
