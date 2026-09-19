import type { AdminOrderFiltersQuery } from "@/modules/orders/schemas/admin-order.schema";
import { ORDER_STATUS_VALUES } from "@/modules/orders/schemas/admin-order.schema";
import type { OrderStatus } from "@/server/db/schema/order";

/**
 * Re-exportado, nunca redefinido: el tope de filas es del contrato (lo aplica el
 * repositorio y lo lee el aviso de truncado) y vive en el schema, el único
 * archivo que servidor y cliente comparten (012 §Notas de implementación).
 */
export { ADMIN_ORDER_LIMIT } from "@/modules/orders/schemas/admin-order.schema";

/**
 * Filtros ya resueltos, tal como viajan al endpoint. Se derivan del schema en
 * vez de redeclararse; solo `from`/`to` cambian de forma, porque en el cliente
 * son texto ISO: el `z.input` de un `z.coerce.date()` es `unknown` y no sirve
 * para tipar ni el estado ni la clave de caché.
 */
export type AdminOrderQuery = Omit<AdminOrderFiltersQuery, "from" | "to"> & {
  from?: string;
  to?: string;
};

export const adminOrderKeys = {
  all: ["admin-orders"] as const,
  lists: () => [...adminOrderKeys.all, "list"] as const,
  /** Los filtros forman parte de la clave: cada combinación es su propia entrada. */
  list: (query: AdminOrderQuery) => [...adminOrderKeys.lists(), query] as const,
  detail: (orderId: string) =>
    [...adminOrderKeys.all, "detail", orderId] as const,
  receipt: (orderId: string) =>
    [...adminOrderKeys.all, "receipt", orderId] as const,
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido",
  canceled: "Cancelado",
};

/** Variante del `Badge` por estado; la comparten tabla y diálogo. */
export const ORDER_STATUS_VARIANTS: Record<
  OrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  paid: "default",
  failed: "destructive",
  canceled: "secondary",
};

export const ORDER_STATUS_OPTIONS = ORDER_STATUS_VALUES.map((status) => ({
  value: status,
  label: ORDER_STATUS_LABELS[status],
}));

/**
 * Estado crudo de la barra de filtros: lo que hay escrito en los inputs, con
 * `""` como "sin filtro". Se traduce a `AdminOrderQuery` al aplicar.
 */
export type AdminOrderFilterDraft = {
  /** Fecha civil `YYYY-MM-DD` del `input[type=date]`, sin hora ni zona. */
  from: string;
  to: string;
  status: string;
  customer: string;
};

export const EMPTY_ADMIN_ORDER_DRAFT: AdminOrderFilterDraft = {
  from: "",
  to: "",
  status: "",
  customer: "",
};

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` a medianoche local; `new Date(texto)` lo leería en UTC. */
function parseDateInput(value: string): Date | null {
  const match = DATE_INPUT_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Traduce la barra de filtros al contrato del endpoint.
 *
 * El "hasta" del usuario es un día completo y el filtro SQL es `[from, to)`, así
 * que se manda el arranque del día siguiente (§Notas, zona horaria): con el
 * propio día se perderían los pedidos de esa tarde.
 *
 * `customer` va recortado y se omite si queda vacío: el schema rechaza la
 * cadena vacía con un 400 a propósito, no la ignora.
 */
export function toAdminOrderQuery(
  draft: AdminOrderFilterDraft,
): AdminOrderQuery {
  const from = parseDateInput(draft.from);
  const to = parseDateInput(draft.to);

  if (to) {
    to.setDate(to.getDate() + 1);
  }

  const customer = draft.customer.trim();

  return {
    from: from?.toISOString(),
    to: to?.toISOString(),
    status: ORDER_STATUS_VALUES.find((status) => status === draft.status),
    customer: customer.length > 0 ? customer : undefined,
  };
}
