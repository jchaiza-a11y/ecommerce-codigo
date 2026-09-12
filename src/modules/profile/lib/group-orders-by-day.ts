import { toDateInputValue } from "@/modules/profile/constants";
import type { OrderHistoryItem } from "@/modules/profile/schemas/order-history.schema";

export type OrderDayGroup = {
  /** `YYYY-MM-DD` local: sirve de clave de React y de criterio de orden. */
  key: string;
  /** "9 de septiembre de 2026" (AC1). */
  label: string;
  orders: OrderHistoryItem[];
};

// Instanciado a nivel de módulo: crear un `Intl.DateTimeFormat` por cabecera es
// caro y todas las cabeceras comparten formato.
const dayLabelFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
});

const timeFormatter = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatOrderTime(isoDate: string): string {
  return timeFormatter.format(new Date(isoDate));
}

/**
 * Agrupa el historial por día **en la zona del usuario**. En SQL, `date_trunc`
 * usaría la del servidor (UTC) y una compra de las 23:30 aparecería al día
 * siguiente (009 §Datos).
 *
 * La API ya devuelve las filas en `created_at desc`, así que el `Map` conserva
 * ese orden; el `sort` final lo garantiza aunque el origen cambie (AC1).
 */
export function groupOrdersByDay(
  items: readonly OrderHistoryItem[],
): OrderDayGroup[] {
  const groups = new Map<string, OrderDayGroup>();

  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = toDateInputValue(date);
    const group = groups.get(key);

    if (group) {
      group.orders.push(item);
      continue;
    }

    groups.set(key, { key, label: dayLabelFormatter.format(date), orders: [item] });
  }

  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}
