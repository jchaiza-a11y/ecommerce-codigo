/**
 * Constantes del dominio del dashboard admin (011 T14). Sin imports de
 * servidor: lo consumen hooks y componentes de cliente.
 */

export const dashboardKeys = {
  all: ["dashboard"] as const,
  metrics: () => [...dashboardKeys.all, "metrics"] as const,
};

/**
 * Intervalo de polling del dashboard (011 §Alcance, AC6). Debe quedar por
 * encima del `staleTime` del hook para que cada refetch traiga datos nuevos.
 */
export const POLL_INTERVAL_MS = 30_000;

/**
 * Tamaño de la ventana de métricas, en días. Es documentacional en el cliente:
 * el servidor calcula su propio rango; aquí solo alimenta textos de UI
 * ("Últimos 30 días").
 */
export const RANGE_DAYS = 30;
