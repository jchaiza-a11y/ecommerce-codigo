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
 * Tamaño de la ventana de métricas, en días. Fuente única: la consume tanto
 * `server/services/dashboard.service.ts` para calcular el rango como los textos
 * de UI ("Últimos 30 días"), así que no pueden desincronizarse.
 */
export const RANGE_DAYS = 30;

// `useGrouping: "always"` por el mismo motivo que en `products/constants.ts`:
// `es-ES` usa `minimumGroupingDigits: 2` y dejaría `1234` sin separador.
const integerFormatter = new Intl.NumberFormat("es-ES", {
  useGrouping: "always",
  maximumFractionDigits: 0,
});

/**
 * Magnitudes discretas del dashboard (pedidos, unidades, stock). Los importes
 * NO pasan por aquí: van siempre con `formatPrice()` (AC10).
 */
export function formatUnits(value: number): string {
  return integerFormatter.format(value);
}
