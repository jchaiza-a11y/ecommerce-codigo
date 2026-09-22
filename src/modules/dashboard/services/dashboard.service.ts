import { api } from "@/lib/axios";
import type { DashboardMetrics } from "@/modules/dashboard/types/dashboard.types";

const RESOURCE = "/api/admin/metrics";

/**
 * Lee las métricas del dashboard admin (011 T13).
 *
 * El endpoint no acepta query params ni body: la ventana de 30 días la fija el
 * servidor (011 §API), así que la firma no recibe argumentos.
 *
 * Sin copia local de `getApiErrorMessage`: este módulo es posterior a 008 y
 * consume el helper transversal de `@/lib/api-error` desde la capa de UI.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await api.get<DashboardMetrics>(RESOURCE);

  return data;
}
