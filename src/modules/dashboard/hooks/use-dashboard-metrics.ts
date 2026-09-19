"use client";

import { useQuery } from "@tanstack/react-query";

import { dashboardKeys, POLL_INTERVAL_MS } from "@/modules/dashboard/constants";
import { getDashboardMetrics } from "@/modules/dashboard/services/dashboard.service";

/**
 * Métricas del dashboard admin con refresco automático (011 T15, AC6).
 *
 * `staleTime: 0` sobrescribe el global de 60 s de `makeQueryClient()`
 * (`src/lib/query-client.ts`), que es mayor que el intervalo de polling: sin
 * esto el `refetchInterval` dispararía pero la query se consideraría fresca y
 * se serviría la respuesta cacheada en vez de pedir datos nuevos.
 *
 * `refetchIntervalInBackground: false` detiene el polling cuando la pestaña no
 * está visible.
 */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: dashboardKeys.metrics(),
    queryFn: getDashboardMetrics,
    staleTime: 0,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}
