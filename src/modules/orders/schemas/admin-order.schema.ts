import { z } from "zod";

import type { Order, OrderStatus } from "@/server/db/schema/order";
import type { OrderItem } from "@/server/db/schema/order-item";
import type { User } from "@/server/db/schema/user";

/**
 * Ventana por defecto del listado (012 §Decisiones 3). Un panel mira el mes en
 * curso, no el año pasado: el periodo sustituye a la paginación.
 */
export const DEFAULT_RANGE_DAYS = 90;

/**
 * Tope duro de filas. Vive aquí, y no en el repositorio ni en `constants.ts`,
 * porque servidor y cliente lo necesitan (el segundo solo para el aviso de
 * truncado) y este archivo es el único que ambos pueden importar sin arrastrar
 * Drizzle al bundle.
 */
export const ADMIN_ORDER_LIMIT = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

export const RANGE_ORDER_MESSAGE =
  "La fecha final debe ser posterior a la inicial";

/**
 * `Record<OrderStatus, true>` fuerza la exhaustividad: si el pgEnum
 * `order_status` gana o pierde un valor, esto deja de compilar. Se replica en
 * vez de importar `orderStatus.enumValues` porque el schema viaja al cliente y
 * no debe arrastrar el runtime de Drizzle al bundle.
 */
const ORDER_STATUS_PRESENCE: Record<OrderStatus, true> = {
  pending: true,
  paid: true,
  failed: true,
  canceled: true,
};

export const ORDER_STATUS_VALUES = Object.keys(
  ORDER_STATUS_PRESENCE,
) as OrderStatus[];

/**
 * Filtros del listado de administración. Los tres viajan como query params y se
 * resuelven en SQL (§Decisiones 2): los pedidos crecen sin techo y un rango de
 * fechas no se expresa con un `Select` de exact-match.
 *
 * `from`/`to` son instantes absolutos: el cliente convierte la fecha civil del
 * `input[type="date"]` antes de mandarla y el servidor no adivina zona horaria.
 * El intervalo es `[from, to)`.
 */
export const adminOrderFiltersSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    status: z.enum(ORDER_STATUS_VALUES).optional(),
    customer: z.string().trim().min(1).max(120).optional(),
  })
  .refine(
    (filters) =>
      !filters.from || !filters.to || filters.to.getTime() > filters.from.getTime(),
    { message: RANGE_ORDER_MESSAGE, path: ["to"] },
  );

export type AdminOrderFiltersQuery = z.infer<typeof adminOrderFiltersSchema>;

/**
 * Completa la ventana consultada. Sin fechas son los últimos `DEFAULT_RANGE_DAYS`
 * días (AC6); con solo `to`, los 90 días anteriores a esa fecha.
 */
export function resolveAdminOrderRange(
  filters: Pick<AdminOrderFiltersQuery, "from" | "to">,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = filters.to ?? now;
  const from =
    filters.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

  return { from, to };
}

/**
 * Contrato de salida. Derivado de las filas de Drizzle en vez de redeclararse
 * (CLAUDE.md §4.5): `createdAt` es lo único que cambia de forma, porque un
 * `Date` no sobrevive a `JSON.stringify` con su tipo.
 */
export type AdminOrderCustomer = {
  id: User["id"];
  /** `null` cuando Clerk todavía no mandó ni nombre ni apellido. */
  name: string | null;
  email: User["email"];
};

/** Constructor del DTO de cliente: una sola forma de componer el nombre. */
export function toAdminOrderCustomer(
  customer: Pick<User, "id" | "firstName" | "lastName" | "email">,
): AdminOrderCustomer {
  const name = [customer.firstName, customer.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  return {
    id: customer.id,
    name: name.length > 0 ? name : null,
    email: customer.email,
  };
}

type AdminOrderHeader = Pick<
  Order,
  "id" | "status" | "totalCents" | "currency"
> & {
  createdAt: string;
  customer: AdminOrderCustomer;
};

/** La lista no trae líneas: el desglose lo pide el diálogo al abrirse (§Decisiones 4). */
export type AdminOrderListItem = AdminOrderHeader & { itemCount: number };

export type AdminOrderListResponse = {
  items: AdminOrderListItem[];
  /** `true` cuando se alcanzó `ADMIN_ORDER_LIMIT` y hay pedidos fuera (AC8). */
  truncated: boolean;
};

export type AdminOrderLine = Pick<
  OrderItem,
  "id" | "productName" | "unitPriceCents" | "quantity"
>;

export type AdminOrderDetail = AdminOrderHeader & { items: AdminOrderLine[] };
