import "server-only";

import type Stripe from "stripe";

import { getAppUrl } from "@/lib/app-url";
import { stripe } from "@/lib/stripe";
import type { SavedCard } from "@/modules/profile/schemas/saved-card.schema";
import type { PaymentMethod } from "@/server/db/schema/payment-method";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";
import * as userRepository from "@/server/repositories/user.repository";

/** Mínimo que necesita el servicio del usuario en sesión: nunca el `clerkId`. */
export type SavedCardActor = {
  /** `users.id` local, que es la FK de `payment_methods.user_id`. */
  id: string;
  email: string;
};

export type SaveSetupSessionResult =
  | { status: "saved"; card: SavedCard }
  /** Sesión inexistente, de otro usuario o que no es de tipo `setup` (AC7). */
  | { status: "not_found" }
  /** La sesión existe pero Stripe todavía no ha resuelto el método de pago. */
  | { status: "pending" };

export type RemoveSavedCardResult =
  | { status: "removed" }
  | { status: "not_found" }
  | { status: "stripe_unavailable" };

/** Fila de Postgres al contrato público: sin ids de Stripe (010 §API). */
export function toSavedCard(row: PaymentMethod): SavedCard {
  return {
    id: row.id,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    createdAt: row.createdAt.toISOString(),
  };
}

/** `resource_missing`: el objeto ya no existe en Stripe, no es un fallo de red. */
function isResourceMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "resource_missing"
  );
}

/**
 * Devuelve el Customer de Stripe del usuario, creándolo la primera vez.
 *
 * El `attachStripeCustomerId` solo escribe si la columna sigue a `NULL`: cuando
 * dos peticiones simultáneas —guardar una tarjeta y pagar— crean cada una su
 * Customer, la que pierde la carrera relee la fila y usa el ya persistido. El
 * Customer sobrante queda huérfano en Stripe, sin coste ni efecto (010 §Notas).
 */
export async function ensureStripeCustomer(
  actor: SavedCardActor,
): Promise<string> {
  const existing = await userRepository.findById(actor.id);

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: actor.email,
    metadata: { userId: actor.id },
  });

  const attached = await userRepository.attachStripeCustomerId(
    actor.id,
    customer.id,
  );

  if (attached?.stripeCustomerId) {
    return attached.stripeCustomerId;
  }

  const reread = await userRepository.findById(actor.id);

  return reread?.stripeCustomerId ?? customer.id;
}

/**
 * Checkout Session `mode: "setup"` (decisión 2): la misma página hospedada del
 * pago, pero con un SetupIntent debajo y sin cargo. `payment_method_types` se
 * fija a `card` porque la pestaña es "Mis tarjetas": un método dinámico
 * (SEPA, PayPal) no tiene `brand` ni `last4` que mostrar.
 *
 * El `client_reference_id` lleva el `users.id`: es lo que permite al webhook
 * saber de quién es la tarjeta cuando el usuario cierra la pestaña (AC4).
 */
export async function createSetupSession(
  actor: SavedCardActor,
): Promise<string> {
  const customerId = await ensureStripeCustomer(actor);
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    client_reference_id: actor.id,
    payment_method_types: ["card"],
    success_url: `${appUrl}/account?tab=cards&setup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/account?tab=cards`,
  });

  if (!session.url) {
    throw new Error(
      `La Checkout Session de setup ${session.id} se creó sin url de redirección`,
    );
  }

  return session.url;
}

function resolvePaymentMethod(
  session: Stripe.Checkout.Session,
): Stripe.PaymentMethod | null {
  const setupIntent = session.setup_intent;

  // Un string suelto significa que el `expand` no se aplicó; sin objeto no hay
  // `card` que leer y el alta se reintentará en la siguiente entrega.
  if (!setupIntent || typeof setupIntent === "string") {
    return null;
  }

  const method = setupIntent.payment_method;

  return !method || typeof method === "string" ? null : method;
}

/**
 * Guarda la tarjeta de una sesión de setup ya completada. La llaman los dos
 * caminos posibles —el retorno del usuario y el webhook—, y por eso recibe el
 * **id** de la sesión: el payload del webhook no viene expandido y el
 * `payment_method` hay que pedirlo igualmente (010 §Notas, doble escritura).
 *
 * `allow_redisplay` nace como `unspecified` en las tarjetas guardadas fuera de
 * un pago, y con ese valor Checkout no las ofrece nunca: forzarlo a `always` es
 * lo que las hace reutilizables (AC10).
 */
export async function savePaymentMethodFromSetupSession(
  setupSessionId: string,
  userId: string,
): Promise<SaveSetupSessionResult> {
  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.retrieve(setupSessionId, {
      expand: ["setup_intent.payment_method"],
    });
  } catch (error) {
    if (isResourceMissing(error)) {
      return { status: "not_found" };
    }

    throw error;
  }

  // La pertenencia se decide contra Stripe, no contra el body: un `cs_` ajeno
  // pegado en la url no puede acabar en la lista de otro usuario (AC7).
  if (session.mode !== "setup" || session.client_reference_id !== userId) {
    return { status: "not_found" };
  }

  if (session.status !== "complete") {
    return { status: "pending" };
  }

  const method = resolvePaymentMethod(session);

  if (!method?.card) {
    return { status: "pending" };
  }

  await stripe.paymentMethods.update(method.id, { allow_redisplay: "always" });

  const saved = await paymentMethodRepository.upsertByStripeId({
    userId,
    stripePaymentMethodId: method.id,
    brand: method.card.brand,
    last4: method.card.last4,
    expMonth: method.card.exp_month,
    expYear: method.card.exp_year,
  });

  // Sin fila: el `payment_method` ya estaba registrado por otro usuario y el
  // upsert no le cambia el dueño. Para quien pregunta, no existe.
  if (!saved) {
    return { status: "not_found" };
  }

  return { status: "saved", card: toSavedCard(saved) };
}

/**
 * Detach en Stripe primero y borrado local después: si el detach falla, la fila
 * se queda: una tarjeta invisible para el usuario pero aún adjunta al Customer
 * seguiría apareciendo en Checkout, que es peor que un error (010 §Notas).
 *
 * `resource_missing` es la excepción: el PaymentMethod ya no existe en Stripe,
 * así que no hay nada adjunto y la fila local es solo basura que sí se limpia.
 */
export async function removeSavedCard(
  userId: string,
  cardId: string,
): Promise<RemoveSavedCardResult> {
  const found = await paymentMethodRepository.findByIdAndUserId(cardId, userId);

  if (!found) {
    return { status: "not_found" };
  }

  try {
    await stripe.paymentMethods.detach(found.stripePaymentMethodId);
  } catch (error) {
    if (!isResourceMissing(error)) {
      console.error("removeSavedCard", error);

      return { status: "stripe_unavailable" };
    }
  }

  await paymentMethodRepository.deleteById(found.id);

  return { status: "removed" };
}
