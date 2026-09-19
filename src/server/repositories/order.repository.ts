import { and, asc, count, desc, eq, gte, ilike, lt, or } from "drizzle-orm";

import {
  ADMIN_ORDER_LIMIT,
  toAdminOrderCustomer,
  type AdminOrderCustomer,
} from "@/modules/orders/schemas/admin-order.schema";
import { db } from "@/server/db";
import { runBatch, type PgStatement } from "@/server/db/batch";
import { order } from "@/server/db/schema/order";
import type { NewOrder, Order, OrderStatus } from "@/server/db/schema/order";
import { orderItem } from "@/server/db/schema/order-item";
import type { NewOrderItem, OrderItem } from "@/server/db/schema/order-item";
import { user } from "@/server/db/schema/user";

/** Línea tal como la recibe el repositorio: el `orderId` lo pone él. */
export type NewOrderItemData = Omit<NewOrderItem, "id" | "orderId">;

export type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Cabecera y líneas en un único `batch`: un pedido sin líneas no es un pedido,
 * así que o entran las dos cosas o no entra ninguna (CLAUDE.md §4.9). El `id`
 * del pedido lo genera el llamador porque dentro de un `batch` no se puede
 * alimentar una sentencia con el `returning()` de otra (003 §8.5).
 */
export async function createWithItems(
  values: NewOrder & { id: string },
  items: readonly NewOrderItemData[],
): Promise<void> {
  await runBatch([
    db.insert(order).values(values),
    db
      .insert(orderItem)
      .values(items.map((item) => ({ ...item, orderId: values.id }))),
  ]);
}

/** Punto de reconciliación del webhook: la sesión de Stripe es única por pedido. */
export async function findByStripeCheckoutSessionId(
  sessionId: string,
): Promise<Order | undefined> {
  const [found] = await db
    .select()
    .from(order)
    .where(eq(order.stripeCheckoutSessionId, sessionId))
    .limit(1);

  return found;
}

export async function findWithItems(
  orderId: string,
): Promise<OrderWithItems | undefined> {
  const rows = await db
    .select({ order, item: orderItem })
    .from(order)
    .innerJoin(orderItem, eq(orderItem.orderId, order.id))
    .where(eq(order.id, orderId))
    .orderBy(asc(orderItem.productName));

  const first = rows[0];

  if (!first) {
    return undefined;
  }

  return { ...first.order, items: rows.map((row) => row.item) };
}

/** Cabecera suelta, sin líneas ni dueño en el `where`: la usa el panel (012 T9). */
export async function findById(orderId: string): Promise<Order | undefined> {
  const [found] = await db
    .select()
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  return found;
}

/** Autoservicio: la propiedad del pedido es parte del `where`, no un chequeo aparte. */
export async function findByIdAndUserId(
  orderId: string,
  userId: string,
): Promise<Order | undefined> {
  const [found] = await db
    .select()
    .from(order)
    .where(and(eq(order.id, orderId), eq(order.userId, userId)))
    .limit(1);

  return found;
}

export type OrderHistoryFilters = {
  /** `users.id` local, no el `clerkId`. */
  userId: string;
  from: Date;
  /** Exclusivo: el intervalo es `[from, to)` (009 §Notas). */
  to: Date;
};

/** Tope duro del historial: el filtro de periodo sustituye a la paginación. */
export const ORDER_HISTORY_LIMIT = 200;

/**
 * Historial de pedidos pagados con sus líneas en una sola consulta: el diálogo
 * de detalle no vuelve a la red por el desglose (009 §Notas, N+1).
 *
 * El `limit` va en la subconsulta de cabeceras, no en el join: aplicado al
 * resultado unido contaría líneas y truncaría un pedido por la mitad.
 *
 * Sin `date_trunc`: agrupar en SQL usaría la zona horaria del servidor (UTC) y
 * partiría mal las compras nocturnas del usuario. Aquí solo se ordena.
 */
export async function findHistoryByUserId({
  userId,
  from,
  to,
}: OrderHistoryFilters): Promise<OrderWithItems[]> {
  const recent = db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.userId, userId),
        eq(order.status, "paid"),
        gte(order.createdAt, from),
        lt(order.createdAt, to),
      ),
    )
    .orderBy(desc(order.createdAt))
    .limit(ORDER_HISTORY_LIMIT)
    .as("recent_orders");

  const rows = await db
    .select({ order, item: orderItem })
    .from(order)
    .innerJoin(recent, eq(recent.id, order.id))
    .innerJoin(orderItem, eq(orderItem.orderId, order.id))
    .orderBy(desc(order.createdAt), asc(orderItem.productName));

  const grouped = new Map<string, OrderWithItems>();

  for (const row of rows) {
    const existing = grouped.get(row.order.id);

    if (existing) {
      existing.items.push(row.item);
      continue;
    }

    grouped.set(row.order.id, { ...row.order, items: [row.item] });
  }

  return [...grouped.values()];
}

export type AdminOrderFilters = {
  from: Date;
  /** Exclusivo: el intervalo es `[from, to)` (012 §Notas, zona horaria). */
  to: Date;
  /** Estado exacto; sin él vuelven los cuatro. */
  status?: OrderStatus;
  /** Texto libre contra nombre, apellido o email del cliente. */
  customer?: string;
};

/** Fila del listado admin: el cliente y el nº de líneas llegan ya resueltos. */
export type AdminOrderListRow = Order & {
  itemCount: number;
  customer: AdminOrderCustomer;
};

/**
 * Listado del panel con los tres filtros resueltos en SQL (012 §Decisiones 2).
 *
 * `itemCount` sale de un agregado en la misma consulta, nunca de una query por
 * fila (§Notas, N+1), y el join a `order_items` es `LEFT` para que un pedido
 * sin líneas siga apareciendo con 0 en vez de desaparecer del listado.
 *
 * `group by` sobre las dos PK basta en Postgres: el resto de columnas de
 * `orders` y `users` depende funcionalmente de ellas.
 *
 * El `ilike '%texto%'` no usa índice; es aceptable porque el rango de fechas
 * acota primero (§Notas). No se introduce `pg_trgm` sin medición.
 */
export async function findAdminOrders({
  from,
  to,
  status,
  customer,
}: AdminOrderFilters): Promise<AdminOrderListRow[]> {
  const pattern = customer ? `%${customer}%` : undefined;

  const rows = await db
    .select({
      order,
      customerId: user.id,
      customerFirstName: user.firstName,
      customerLastName: user.lastName,
      customerEmail: user.email,
      itemCount: count(orderItem.id),
    })
    .from(order)
    .innerJoin(user, eq(user.id, order.userId))
    .leftJoin(orderItem, eq(orderItem.orderId, order.id))
    .where(
      and(
        gte(order.createdAt, from),
        lt(order.createdAt, to),
        status ? eq(order.status, status) : undefined,
        pattern
          ? or(
              ilike(user.firstName, pattern),
              ilike(user.lastName, pattern),
              ilike(user.email, pattern),
            )
          : undefined,
      ),
    )
    .groupBy(order.id, user.id)
    .orderBy(desc(order.createdAt))
    .limit(ADMIN_ORDER_LIMIT);

  return rows.map((row) => ({
    ...row.order,
    itemCount: row.itemCount,
    customer: toAdminOrderCustomer({
      id: row.customerId,
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      email: row.customerEmail,
    }),
  }));
}

/**
 * Sentencias sin ejecutar: el fulfillment las mete en el mismo `batch` que el
 * descuento de stock y el `audit_logs`.
 *
 * El `where status = 'pending'` no es decorativo: es la guarda de idempotencia
 * frente a dos entregas simultáneas del mismo evento. La segunda transacción
 * reevalúa la condición al liberarse el lock de la fila, ve `paid` y no afecta
 * ninguna fila (008 §Notas).
 */
export function buildMarkPaid(
  orderId: string,
  paymentIntentId: string | null,
): PgStatement {
  return db
    .update(order)
    .set({ status: "paid", stripePaymentIntentId: paymentIntentId })
    .where(and(eq(order.id, orderId), eq(order.status, "pending")));
}

export function buildMarkFailed(
  orderId: string,
  paymentIntentId: string | null,
): PgStatement {
  return db
    .update(order)
    .set({ status: "failed", stripePaymentIntentId: paymentIntentId })
    .where(and(eq(order.id, orderId), eq(order.status, "pending")));
}
