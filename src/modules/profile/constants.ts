import type { OrderHistoryQuery } from "@/modules/profile/schemas/order-history.schema";

export const orderHistoryKeys = {
  all: ["profile-orders"] as const,
  /** Cada rango es su propia entrada de caché: el filtro forma parte de la clave. */
  history: (range: OrderHistoryQuery) =>
    [...orderHistoryKeys.all, "history", range] as const,
  receipt: (orderId: string) =>
    [...orderHistoryKeys.all, "receipt", orderId] as const,
};

/** Pestañas de `/account`; el orden es el de la barra. */
export const ACCOUNT_TABS = [
  "profile",
  "favorites",
  "orders",
  "cards",
] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** `?tab=` viene del navegador: un valor desconocido cae al perfil, no rompe. */
export function parseAccountTab(value: unknown): AccountTab {
  return ACCOUNT_TABS.find((tab) => tab === value) ?? "profile";
}

export const savedCardKeys = {
  all: ["profile-saved-cards"] as const,
  list: () => [...savedCardKeys.all, "list"] as const,
};

/**
 * `card.brand` de Stripe en su nombre comercial. La empresa emisora sale de
 * aquí y no de los primeros dígitos: el BIN nunca se expone por PCI-DSS
 * (010 §Decisión 1). Una marca desconocida cae al propio valor de Stripe.
 */
const CARD_BRAND_LABELS: Record<string, string> = {
  amex: "American Express",
  cartes_bancaires: "Cartes Bancaires",
  diners: "Diners Club",
  discover: "Discover",
  eftpos_au: "Eftpos Australia",
  jcb: "JCB",
  link: "Link",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  visa: "Visa",
  unknown: "Tarjeta",
};

export function formatCardBrand(brand: string): string {
  return CARD_BRAND_LABELS[brand] ?? brand;
}

/**
 * Etiqueta única de una tarjeta, `Marca •••• 4242`. Vive aquí para que la
 * pestaña de la cuenta (AC3) y el selector del carrito (AC9) no puedan
 * divergir en cómo la escriben.
 */
export function formatCardLabel(card: {
  brand: string;
  last4: string;
}): string {
  return `${formatCardBrand(card.brand)} •••• ${card.last4}`;
}

/** Caducidad como `MM/AAAA` (AC3). */
export function formatCardExpiry(month: number, year: number): string {
  return `${pad(month)}/${year}`;
}

export const ORDER_RANGE_MODES = [
  { value: "current-month", label: "Mes actual" },
  { value: "custom", label: "Rango de fechas" },
] as const satisfies readonly { value: string; label: string }[];

export type OrderRangeMode = (typeof ORDER_RANGE_MODES)[number]["value"];

/** Valor de un `input[type=date]`: fecha civil `YYYY-MM-DD`, sin hora ni zona. */
export type DateInputRange = { from: string; to: string };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * `toISOString().slice(0, 10)` daría el día en UTC y adelantaría o atrasaría la
 * fecha según la zona del usuario: se compone a mano desde los getters locales.
 */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` a medianoche local; `new Date(texto)` lo interpretaría en UTC. */
function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Preset por defecto (AC1). Se calcula en el navegador y viaja como instante
 * absoluto: "mes actual" depende de la zona del usuario, no de la del servidor.
 * El `to` es el arranque del mes siguiente porque el filtro SQL es `[from, to)`.
 */
export function getCurrentMonthRange(now: Date = new Date()): OrderHistoryQuery {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { from: from.toISOString(), to: to.toISOString() };
}

/** Días civiles del formulario en instantes locales para la UI del preset. */
export function getCurrentMonthDateInputs(
  now: Date = new Date(),
): DateInputRange {
  return {
    from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInputValue(now),
  };
}

/**
 * El "hasta" del usuario es un día completo, así que se envía el inicio del día
 * siguiente (AC2): con el propio día se perderían las compras de esa tarde.
 *
 * Devuelve `null` solo si falta una fecha o está malformada. Un rango invertido
 * o desmedido sí se envía: quien lo rechaza con su mensaje es la API (AC3).
 */
export function toRangeFromDateInputs(
  range: DateInputRange,
): OrderHistoryQuery | null {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);

  if (!from || !to) {
    return null;
  }

  const exclusiveTo = new Date(to);
  exclusiveTo.setDate(exclusiveTo.getDate() + 1);

  return { from: from.toISOString(), to: exclusiveTo.toISOString() };
}
