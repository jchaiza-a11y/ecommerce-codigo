import { NextResponse } from "next/server";

import { getCurrentUserState } from "@/lib/auth";
import { UNSYNCED_MESSAGE } from "@/lib/permissions";
import { checkoutSessionSchema } from "@/modules/checkout/schemas/checkout.schema";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";
import { createCheckoutSession } from "@/server/services/checkout.service";

/**
 * Autoservicio: exige sesión pero ningún `permission.code`. Comprar es lo que
 * cualquier cliente autenticado puede hacer; los permisos gobiernan el panel.
 */
export async function POST(request: Request) {
  const state = await getCurrentUserState();

  if (state.status === "anonymous") {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión para pagar" },
      { status: 401 },
    );
  }

  // Sin fila en `users` no hay `orders.user_id` posible: es un fallo de
  // sincronización, no de permisos, y se dice como tal (003 §11).
  if (state.status === "unsynced") {
    return NextResponse.json({ error: UNSYNCED_MESSAGE }, { status: 403 });
  }

  if (!state.user.isActive) {
    return NextResponse.json(
      { error: "Tu cuenta está desactivada" },
      { status: 403 },
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

  const parsed = checkoutSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { items, savedCardId } = parsed.data;

  try {
    // La tarjeta se resuelve antes de tocar Stripe: una ajena responde 404 y no
    // llega a crearse ni la sesión ni el pedido (AC12). 404 y no 403 porque un
    // 403 confirmaría que ese id existe.
    if (savedCardId) {
      const owned = await paymentMethodRepository.findByIdAndUserId(
        savedCardId,
        state.user.id,
      );

      if (!owned) {
        return NextResponse.json(
          { error: "No encontramos esa tarjeta" },
          { status: 404 },
        );
      }
    }

    const result = await createCheckoutSession(
      { id: state.user.id, email: state.user.email },
      items,
      { useSavedCards: savedCardId !== undefined },
    );

    if (result.status === "unavailable") {
      return NextResponse.json(
        { error: result.message, productName: result.productName },
        { status: 409 },
      );
    }

    return NextResponse.json({ url: result.url, orderId: result.orderId });
  } catch (error) {
    console.error("POST /api/checkout/session", error);

    return NextResponse.json(
      { error: "No se pudo iniciar el pago" },
      { status: 500 },
    );
  }
}
