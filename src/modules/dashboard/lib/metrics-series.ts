import type { DailyMetric } from "@/modules/dashboard/types/dashboard.types";

/** Día UTC de una fecha, en `YYYY-MM-DD`. */
function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Medianoche UTC de `start + offset` días; descarta la hora de `start`. */
function addUtcDays(start: Date, offset: number): Date {
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + offset),
  );
}

/**
 * Rellena con ceros los días sin ventas de la serie diaria (AC3): el gráfico
 * necesita exactamente `days` puntos consecutivos, y `GROUP BY` solo devuelve
 * los días que tienen pedidos pagados.
 *
 * Devuelve siempre `days` elementos en orden ascendente desde el día UTC de
 * `start`. Las filas fuera de ese rango se descartan; el orden de entrada es
 * indiferente. La query agrupa por día, así que se espera como mucho una fila
 * por fecha.
 */
export function fillMissingDays(
  rows: readonly DailyMetric[],
  start: Date | string,
  days: number,
): DailyMetric[] {
  const startDate = typeof start === "string" ? new Date(start) : start;

  // `date_trunc` puede llegar como timestamp ISO completo según cómo lo
  // serialice el driver; la clave es siempre el día.
  const byDay = new Map(rows.map((row) => [row.date.slice(0, 10), row]));

  const series: DailyMetric[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = toUtcDayKey(addUtcDays(startDate, offset));
    const row = byDay.get(date);

    series.push({
      date,
      salesCents: row?.salesCents ?? 0,
      orders: row?.orders ?? 0,
    });
  }

  return series;
}

/**
 * Ticket promedio en centavos enteros. Con 0 pedidos devuelve 0 en vez de
 * `NaN`/`Infinity` (AC4).
 */
export function averageTicketCents(salesCents: number, orders: number): number {
  if (orders <= 0) return 0;

  return Math.round(salesCents / orders);
}
