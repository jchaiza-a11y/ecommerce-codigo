/**
 * Constantes del dominio de inventario (013 T15). Sin imports de servidor: lo
 * consumen hooks y componentes de cliente.
 */

export const inventoryKeys = {
  all: ["inventory"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
};

export type StockStatus = "out_of_stock" | "low" | "ok";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out_of_stock: "Agotado",
  low: "Stock bajo",
  ok: "OK",
};

// Variantes literales en vez de derivarlas de `badgeVariants`: importar el
// componente aquí arrastraría un `.tsx` a un módulo que los tests cargan en
// Node sin JSX (mismo criterio que `SEVERITY_VARIANT` en audit-logs).
export const STOCK_STATUS_VARIANTS: Record<
  StockStatus,
  "destructive" | "secondary" | "outline"
> = {
  out_of_stock: "destructive",
  low: "secondary",
  ok: "outline",
};

/**
 * Clasificación de una fila del inventario (013 AC2). Pura y sin React para
 * que la frontera `stock === threshold` se pueda probar sin renderizar.
 *
 * El umbral es inclusivo: con `stock === threshold` el producto ya está bajo
 * mínimos, igual que en el `<=` de la lista de stock bajo del dashboard (011).
 * Con `threshold = 0` solo el agotado alerta, que es justo lo que significa un
 * umbral de cero.
 */
export function getStockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) {
    return "out_of_stock";
  }

  return stock <= threshold ? "low" : "ok";
}

/** Atajo del filtro "solo stock bajo": agotados y bajo mínimos (013 AC3). */
export function isBelowThreshold(stock: number, threshold: number): boolean {
  return getStockStatus(stock, threshold) !== "ok";
}
