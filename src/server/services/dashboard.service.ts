import "server-only";

import {
  averageTicketCents,
  fillMissingDays,
} from "@/modules/dashboard/lib/metrics-series";
import type { DashboardMetrics } from "@/modules/dashboard/types/dashboard.types";
import * as metricsRepository from "@/server/repositories/metrics.repository";

/** Ventana fija del dashboard; no hay selector de rango (011 §Alcance). */
const RANGE_DAYS = 30;

/** Barras del gráfico de productos más vendidos. */
const TOP_PRODUCTS_LIMIT = 10;

/** Filas de stock bajo que viajan en el payload; el KPI cuenta todas. */
const LOW_STOCK_LIST_LIMIT = 10;

/**
 * Techo de seguridad de la consulta de stock bajo: el KPI necesita el total y
 * la lista solo las 10 primeras, así que se piden todas de una vez y se cuenta
 * en memoria en lugar de añadir una segunda query de conteo. Ningún catálogo
 * realista tiene 1000 productos por debajo de su umbral a la vez.
 */
const LOW_STOCK_QUERY_LIMIT = 1000;

/**
 * Inicio de la ventana: medianoche UTC del primer día incluido.
 *
 * Se ancla al día y no a `end - 30 días` exactos porque la serie diaria agrupa
 * por día UTC (011 §Datos): con un instante suelto el primer día quedaría
 * partido y el día en curso caería fuera de los 30 puntos del gráfico pese a
 * sumar en los KPIs.
 */
function startOfUtcWindow(end: Date, days: number): Date {
  return new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate() - (days - 1),
    ),
  );
}

/**
 * Payload completo de `GET /api/admin/metrics`: resuelve la ventana, lanza las
 * cuatro agregaciones en paralelo y compone el resultado. Las queries son
 * independientes entre sí, de ahí el `Promise.all`.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const rangeEnd = new Date();
  const rangeStart = startOfUtcWindow(rangeEnd, RANGE_DAYS);

  const [sales, dailyRows, topProducts, lowStockRows] = await Promise.all([
    metricsRepository.getSalesSummary(rangeStart),
    metricsRepository.getDailySales(rangeStart),
    metricsRepository.getTopProducts(rangeStart, TOP_PRODUCTS_LIMIT),
    metricsRepository.findLowStockProducts(LOW_STOCK_QUERY_LIMIT),
  ]);

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    summary: {
      salesCents: sales.salesCents,
      orders: sales.orders,
      averageTicketCents: averageTicketCents(sales.salesCents, sales.orders),
      lowStockCount: lowStockRows.length,
    },
    daily: fillMissingDays(dailyRows, rangeStart, RANGE_DAYS),
    topProducts,
    // Ya vienen ordenados por `stock` ascendente: los 10 más críticos son los
    // 10 primeros, no hace falta reordenar.
    lowStock: lowStockRows.slice(0, LOW_STOCK_LIST_LIMIT),
  };
}
