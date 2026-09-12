import { NextResponse } from "next/server";

import type {
  SavedCardResponse,
  SavedCardsResponse,
} from "@/modules/profile/schemas/saved-card.schema";
import { confirmSetupSchema } from "@/modules/profile/schemas/saved-card.schema";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";
import {
  savePaymentMethodFromSetupSession,
  toSavedCard,
} from "@/server/services/saved-card.service";

import { CARD_NOT_FOUND_MESSAGE, resolveSavedCardActor } from "./_shared";

const SETUP_PENDING_MESSAGE =
  "Todavía estamos confirmando la tarjeta con Stripe. Vuelve a intentarlo en unos segundos.";

export async function GET() {
  const guard = await resolveSavedCardActor();

  if (guard.status === "denied") {
    return guard.response;
  }

  try {
    const rows = await paymentMethodRepository.listByUserId(guard.actor.id);
    const body: SavedCardsResponse = { items: rows.map(toSavedCard) };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/profile/payment-methods", error);

    return NextResponse.json(
      { error: "No se pudieron cargar tus tarjetas" },
      { status: 500 },
    );
  }
}

/**
 * Confirma la sesión de setup al volver el usuario de Stripe (AC3). No es la
 * única vía: el webhook guarda la misma tarjeta si el usuario cierra la pestaña
 * (AC4), y la unicidad de `stripe_payment_method_id` hace que ambas converjan
 * en una sola fila (AC5).
 */
export async function POST(request: Request) {
  const guard = await resolveSavedCardActor();

  if (guard.status === "denied") {
    return guard.response;
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

  const parsed = confirmSetupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await savePaymentMethodFromSetupSession(
      parsed.data.setupSessionId,
      guard.actor.id,
    );

    // 404 y no 403 para la sesión ajena: un 403 confirmaría que existe (AC7).
    if (result.status === "not_found") {
      return NextResponse.json(
        { error: CARD_NOT_FOUND_MESSAGE },
        { status: 404 },
      );
    }

    if (result.status === "pending") {
      return NextResponse.json(
        { error: SETUP_PENDING_MESSAGE },
        { status: 404 },
      );
    }

    const responseBody: SavedCardResponse = { item: result.card };

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    console.error("POST /api/profile/payment-methods", error);

    return NextResponse.json(
      { error: "No se pudo guardar la tarjeta" },
      { status: 500 },
    );
  }
}
