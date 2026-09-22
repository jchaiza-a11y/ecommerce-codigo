import "server-only";

// `fillMissingDays` es del módulo del dashboard y se reutiliza tal cual (015
// §Reutilizar): el relleno de una serie diaria a N puntos ya está resuelto y
// probado ahí, y duplicarlo aquí solo abriría una segunda versión que mantener.
import { fillMissingDays } from "@/modules/dashboard/lib/metrics-series";
import type { DailyMetric } from "@/modules/dashboard/types/dashboard.types";
// `RANGE_DAYS` vive en el módulo de cliente y se importa desde aquí (y no al
// revés) para que el rango del servidor y los textos "últimos 30 días" de la UI
// no puedan desincronizarse. `constants.ts` no importa nada de `server/`.
import { RANGE_DAYS } from "@/modules/finance/constants";
import { estimateIgvCents } from "@/modules/finance/lib/igv";
import type {
  FinanceDailyPoint,
  FinanceSummary,
} from "@/modules/finance/types/finance.types";
import type { DailyAmount } from "@/server/repositories/finance.repository";
import * as financeRepository from "@/server/repositories/finance.repository";

/**
 * Inicio de la ventana: medianoche UTC del primer día incluido.
 *
 * Se ancla al día y no a `end - 30 días` exactos porque las series diarias
 * agrupan por día UTC: con un instante suelto el primer día quedaría partido y
 * el día en curso caería fuera de los 30 puntos del gráfico pese a sumar en los
 * KPIs.
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
 * `fillMissingDays` habla el tipo del dashboard (`salesCents`/`orders`). Aquí
 * solo interesa el importe del día, así que cada serie entra por `salesCents` y
 * sale por el mismo campo; `orders` no se lee en ningún momento.
 */
function fillAmounts(rows: DailyAmount[], start: Date): DailyMetric[] {
  return fillMissingDays(
    rows.map((row) => ({
      date: row.date,
      salesCents: row.amountCents,
      orders: 0,
    })),
    start,
    RANGE_DAYS,
  );
}

function sumValues(amounts: Record<string, number>): number {
  return Object.values(amounts).reduce((total, amount) => total + amount, 0);
}

/**
 * Payload completo de `GET /api/admin/finance/summary`: resuelve la ventana,
 * lanza las agregaciones en paralelo y compone el resumen.
 *
 * La ganancia neta es ingresos − egresos: el IGV va aparte y **no** se resta,
 * por decisión ya tomada en el spec (015 AC2).
 */
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const rangeEnd = new Date();
  const rangeStart = startOfUtcWindow(rangeEnd, RANGE_DAYS);

  const [totals, ledger] = await Promise.all([
    financeRepository.getSummaryTotals(rangeStart, rangeEnd),
    financeRepository.getDailyLedger(rangeStart, rangeEnd),
  ]);

  const incomeCents = sumValues(totals.incomeByOrigin);
  const expenseTotalCents = sumValues(totals.expenseByOrigin);

  // La cobertura se mide contra la venta registrada como ingreso de pedido: un
  // ingreso manual no tiene líneas que costear y falsearía el porcentaje.
  const orderIncomeCents = totals.incomeByOrigin.order;
  const coveredSalesCents = Math.max(
    orderIncomeCents - totals.excludedSalesCents,
    0,
  );

  const incomeSeries = fillAmounts(ledger.income, rangeStart);
  const expenseSeries = fillAmounts(ledger.expense, rangeStart);

  const daily: FinanceDailyPoint[] = incomeSeries.map((day, index) => ({
    date: day.date,
    incomeCents: day.salesCents,
    // Las dos series salen de `fillMissingDays` con el mismo rango y longitud,
    // así que el índice apunta al mismo día en ambas.
    expenseCents: expenseSeries[index].salesCents,
  }));

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    incomeCents,
    expenseCents: {
      cogs: totals.expenseByOrigin.order_cogs,
      shipping: totals.expenseByOrigin.order_shipping,
      total: expenseTotalCents,
    },
    igvCents: estimateIgvCents(incomeCents),
    netProfitCents: incomeCents - expenseTotalCents,
    costCoverage: {
      coveredSalesCents,
      excludedSalesCents: totals.excludedSalesCents,
      // Sin ventas en el rango no hay nada descubierto que advertir, y así el
      // cociente nunca divide por cero (AC4).
      coveragePct:
        orderIncomeCents > 0
          ? Math.round((coveredSalesCents / orderIncomeCents) * 100)
          : 100,
    },
    daily,
  };
}
