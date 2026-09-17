/**
 * Payload de `GET /api/admin/metrics` (011 §API).
 *
 * Se declara a mano y no con `InferSelectModel`: es un DTO de negocio agregado
 * sobre `orders`, `order_items` y `products`, no la fila de ninguna tabla, así
 * que no hay schema Drizzle del que derivarlo.
 *
 * Todos los importes son enteros en centavos.
 */

/** KPIs de la ventana completa (30 días). */
export type DashboardSummary = {
  salesCents: number;
  orders: number;
  /** `salesCents / orders` redondeado; `0` cuando no hay pedidos (AC4). */
  averageTicketCents: number;
  lowStockCount: number;
};

/** Un punto de la serie diaria; siempre hay uno por día del rango (AC3). */
export type DailyMetric = {
  /** Día UTC en formato `YYYY-MM-DD`. */
  date: string;
  salesCents: number;
  orders: number;
};

/** Fila del top de productos por unidades vendidas. */
export type TopProduct = {
  productId: string;
  name: string;
  units: number;
  salesCents: number;
};

/** Producto activo cuyo `stock` no supera su `low_stock_threshold` (AC5). */
export type LowStockItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
};

export type DashboardMetrics = {
  /** Inicio del rango, ISO 8601. */
  rangeStart: string;
  /** Fin del rango, ISO 8601. */
  rangeEnd: string;
  summary: DashboardSummary;
  daily: DailyMetric[];
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
};
