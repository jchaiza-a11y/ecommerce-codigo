"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { KpiCards } from "@/modules/dashboard/components/kpi-cards";
import { LowStockList } from "@/modules/dashboard/components/low-stock-list";
import { SalesLineChart } from "@/modules/dashboard/components/sales-line-chart";
import { TopProductsChart } from "@/modules/dashboard/components/top-products-chart";
import { useDashboardMetrics } from "@/modules/dashboard/hooks/use-dashboard-metrics";

const LAYOUT = "flex flex-col gap-6";
const KPI_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";
const CHART_GRID = "grid gap-6 xl:grid-cols-2";

/**
 * Alturas del esqueleto, alineadas con lo que ocupa cada bloque ya resuelto:
 * la tarjeta de KPI (cabecera + cifra), la de evolución diaria (cabecera + dos
 * facets de `h-44`) y la lista de stock bajo. No son medidas exactas al píxel,
 * pero reservan el área completa para que la llegada de datos no descoloque la
 * página (AC8).
 */
function DashboardSkeleton() {
  return (
    <div className={LAYOUT} aria-busy aria-label="Cargando métricas">
      <div className={KPI_GRID}>
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-[108px] w-full rounded-xl" />
        ))}
      </div>

      <div className={CHART_GRID}>
        <Skeleton className="h-[420px] w-full rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>

      <Skeleton className="h-[320px] w-full rounded-xl" />
    </div>
  );
}

/**
 * Frontera de cliente del dashboard (011 T20): es el único punto del módulo que
 * consume el hook, y cubre los estados que los componentes de la Fase F no
 * contemplan porque reciben datos ya resueltos.
 *
 * Los estados vacíos por bloque (AC9) no se deciden aquí: cada componente pinta
 * su `DashboardEmpty` cuando su propio array llega vacío, así que los arrays se
 * pasan tal cual vienen del payload.
 */
export function DashboardView() {
  const metricsQuery = useDashboardMetrics();

  if (metricsQuery.isPending) {
    return <DashboardSkeleton />;
  }

  const metrics = metricsQuery.data;

  return (
    <div className={LAYOUT}>
      {/* El aviso no sustituye al contenido: con polling cada 30 s, un fallo
          puntual no debe vaciar un dashboard que ya se estaba leyendo, así que
          se apila sobre la última lectura buena cuando la hay. */}
      {metricsQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">
            No se pudieron cargar las métricas
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getApiErrorMessage(
              metricsQuery.error,
              "Inténtalo de nuevo en unos momentos.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => metricsQuery.refetch()}
            disabled={metricsQuery.isFetching}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {metrics ? (
        <>
          <KpiCards summary={metrics.summary} />

          <div className={CHART_GRID}>
            <SalesLineChart data={metrics.daily} />
            <TopProductsChart data={metrics.topProducts} />
          </div>

          <LowStockList data={metrics.lowStock} />
        </>
      ) : null}
    </div>
  );
}
