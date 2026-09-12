import { and, desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { paymentMethod } from "@/server/db/schema/payment-method";
import type {
  NewPaymentMethod,
  PaymentMethod,
} from "@/server/db/schema/payment-method";

/** Alta tal como la manda el servicio: el `id` local lo pone Postgres. */
export type UpsertPaymentMethodData = Omit<
  NewPaymentMethod,
  "id" | "createdAt" | "updatedAt"
>;

/** La más reciente primero: es la que Stripe prellena en Checkout (010 §Notas). */
export async function listByUserId(userId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethod)
    .where(eq(paymentMethod.userId, userId))
    .orderBy(desc(paymentMethod.createdAt));
}

/**
 * Idempotencia del alta (AC5): el retorno del usuario y el webhook confirman la
 * misma sesión a la vez, así que la unicidad la resuelve el índice sobre
 * `stripe_payment_method_id` y no un `select` previo, que no es atómico.
 *
 * El `setWhere` impide que un `payment_method` ya registrado por otro usuario
 * cambie de dueño: en ese caso no se actualiza nada y el `returning()` viene
 * vacío, que el servicio traduce a "no encontrada".
 */
export async function upsertByStripeId(
  data: UpsertPaymentMethodData,
): Promise<PaymentMethod | undefined> {
  const [saved] = await db
    .insert(paymentMethod)
    .values(data)
    .onConflictDoUpdate({
      target: paymentMethod.stripePaymentMethodId,
      set: {
        brand: data.brand,
        last4: data.last4,
        expMonth: data.expMonth,
        expYear: data.expYear,
        updatedAt: new Date(),
      },
      setWhere: eq(paymentMethod.userId, data.userId),
    })
    .returning();

  return saved;
}

/** Autoservicio: la propiedad de la tarjeta es parte del `where` (AC7). */
export async function findByIdAndUserId(
  id: string,
  userId: string,
): Promise<PaymentMethod | undefined> {
  const [found] = await db
    .select()
    .from(paymentMethod)
    .where(and(eq(paymentMethod.id, id), eq(paymentMethod.userId, userId)))
    .limit(1);

  return found;
}

export async function deleteById(id: string): Promise<void> {
  await db.delete(paymentMethod).where(eq(paymentMethod.id, id));
}
