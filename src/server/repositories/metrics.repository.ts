import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  lte,
  sql,
  sum,
} from "drizzle-orm";

import type {
  DailyMetric,
  DashboardSummary,
  LowStockItem,
  TopProduct,
} from "@/modules/dashboard/types/dashboard.types";
import { db } from "@/server/db";
import { order } from "@/server/db/schema/order";
import { orderItem } from "@/server/db/schema/order-item";
import { product } from "@/server/db/schema/product";

/**
 * Agregaciones de solo lectura del dashboard de administración (011 §API).
 *
 * El repositorio solo consulta: la ventana de fechas, el relleno de días sin
 * ventas y el armado del payload son del servicio. Aquí no se valida permiso
 * ni se decide el rango.
 */

/** Los KPIs de venta de la ventana completa, sin el resto del resumen. */
export type SalesSummary = Pick<DashboardSummary, "salesCents" | "orders">;

/**
 * `sum()` llega como `string` (Postgres devuelve `numeric`/`bigint` y el driver
 * no lo convierte) o como `null` cuando la agregación no vio ninguna fila. Todo
 * este dominio son centavos y unidades enteras: se normaliza a entero una sola
 * vez, aquí, para que nadie aguas abajo reciba `null` ni `NaN` (AC4).
 */
function toInteger(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/** Solo lo cobrado es venta: `pending`, `failed` y `canceled` no suman (AC2). */
function paidSince(since: Date) {
  return and(eq(order.status, "paid"), gte(order.createdAt, since));
}

/**
 * Día del pedido como `YYYY-MM-DD` UTC. `created_at` es `timestamptz`, así que
 * un `date_trunc` a secas cortaría por la zona horaria de la sesión: el
 * `at time zone 'utc'` fija la referencia que pide 011 §Datos. El formato se
 * hace en SQL y no en JS para no depender de cómo serialice el driver el
 * timestamp resultante.
 */
const UTC_DAY = sql<string>`to_char(date_trunc('day', ${order.createdAt} at time zone 'utc'), 'YYYY-MM-DD')`;

/** T6 — Ventas y pedidos pagados de la ventana. Sin filas, ceros (no `null`). */
export async function getSalesSummary(since: Date): Promise<SalesSummary> {
  const [row] = await db
    .select({ salesCents: sum(order.totalCents), orders: count() })
    .from(order)
    .where(paidSince(since));

  return {
    salesCents: toInteger(row?.salesCents),
    orders: toInteger(row?.orders),
  };
}

/**
 * T7 — Serie diaria de la ventana, en orden ascendente y **sin** los días sin
 * ventas: `GROUP BY` solo devuelve los días con pedidos y el relleno a 30
 * puntos lo hace `fillMissingDays` en el servicio (AC3).
 */
export async function getDailySales(since: Date): Promise<DailyMetric[]> {
  const rows = await db
    .select({
      date: UTC_DAY,
      salesCents: sum(order.totalCents),
      orders: count(),
    })
    .from(order)
    .where(paidSince(since))
    .groupBy(UTC_DAY)
    .orderBy(asc(UTC_DAY));

  return rows.map((row) => ({
    date: row.date,
    salesCents: toInteger(row.salesCents),
    orders: toInteger(row.orders),
  }));
}

const UNITS_SOLD = sum(orderItem.quantity);

/** Importe de las líneas del producto: el precio congelado por su cantidad. */
const LINE_SALES_CENTS = sql<string>`sum(${orderItem.unitPriceCents} * ${orderItem.quantity})`;

/**
 * Nombre congelado de la línea más reciente. Se agrupa por `product_id` y no
 * por `(product_id, product_name)` a propósito: un producto renombrado entre
 * dos compras se partiría en dos barras del gráfico siendo el mismo producto.
 * No se une contra `products.name` porque el snapshot de la compra es el dato
 * correcto para un histórico (008 §order_items, mismo criterio que 009).
 */
const LATEST_PRODUCT_NAME = sql<string>`(array_agg(${orderItem.productName} order by ${order.createdAt} desc))[1]`;

/** T8 — Productos más vendidos de la ventana, por unidades, descendente. */
export async function getTopProducts(
  since: Date,
  limit: number,
): Promise<TopProduct[]> {
  const rows = await db
    .select({
      productId: orderItem.productId,
      name: LATEST_PRODUCT_NAME,
      units: UNITS_SOLD,
      salesCents: LINE_SALES_CENTS,
    })
    .from(orderItem)
    .innerJoin(order, eq(order.id, orderItem.orderId))
    .where(paidSince(since))
    .groupBy(orderItem.productId)
    .orderBy(desc(UNITS_SOLD))
    .limit(limit);

  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    units: toInteger(row.units),
    salesCents: toInteger(row.salesCents),
  }));
}

/**
 * T9 — Productos por debajo de su umbral, del más crítico al menos. Un producto
 * desactivado o con soft delete no existe para el aviso de stock (AC5): el
 * umbral es por producto (`low_stock_threshold`), no una constante global.
 */
export async function findLowStockProducts(
  limit: number,
): Promise<LowStockItem[]> {
  return db
    .select({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      threshold: product.lowStockThreshold,
    })
    .from(product)
    .where(
      and(
        lte(product.stock, product.lowStockThreshold),
        eq(product.isActive, true),
        isNull(product.deletedAt),
      ),
    )
    .orderBy(asc(product.stock), asc(product.name))
    .limit(limit);
}
