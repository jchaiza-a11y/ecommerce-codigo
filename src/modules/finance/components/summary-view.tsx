"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { DailyChart } from "@/modules/finance/components/daily-chart";
import { FinanceError } from "@/modules/finance/components/finance-error";
import { SummaryCards } from "@/modules/finance/components/summary-cards";
import { useFinanceSummary } from "@/modules/finance/hooks/use-finance-summary";

const LAYOUT = "flex flex-col gap-6";
const KPI_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/**
 * Alturas alineadas con lo que ocupa cada bloque ya resuelto (tarjeta de KPI y
 * tarjeta del gráfico): reservan el área completa para que la llegada de datos
 * no descoloque la página (AC8).
 */
function SummarySkeleton() {
  return (
    <div className={LAYOUT} aria-busy aria-label="Cargando resumen financiero">
      <div className={KPI_GRID}>
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-[140px] w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-[420px] w-full rounded-xl" />
    </div>
  );
}

/**
 * Frontera de cliente del resumen financiero (015 T17): único punto del módulo
 * que consume el hook del resumen. El estado vacío por bloque no se decide
 * aquí — el gráfico pinta el suyo cuando el periodo no tuvo movimientos, y los
 * KPIs muestran ceros a propósito (AC4).
 */
export function SummaryView() {
  const summaryQuery = useFinanceSummary();

  if (summaryQuery.isPending) {
    return <SummarySkeleton />;
  }

  if (summaryQuery.isError) {
    return (
      <FinanceError
        title="No se pudo cargar el resumen financiero"
        error={summaryQuery.error}
        onRetry={() => summaryQuery.refetch()}
        isRetrying={summaryQuery.isFetching}
      />
    );
  }

  return (
    <div className={LAYOUT}>
      <SummaryCards summary={summaryQuery.data} />
      <DailyChart data={summaryQuery.data.daily} />
    </div>
  );
}
