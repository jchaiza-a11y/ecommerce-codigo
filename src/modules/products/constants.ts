export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
};

export const PRODUCT_STATUS_OPTIONS = [
  { label: "Activos", value: "true" },
  { label: "Inactivos", value: "false" },
] as const;

// Moneda implícita EUR con formato es-ES (§5.4). Instanciado a nivel de módulo:
// crear un `Intl.NumberFormat` por celda es caro.
// `useGrouping: "always"` es obligatorio: `es-ES` usa `minimumGroupingDigits: 2`
// por defecto y dejaría `1299,99 €` sin separador de millares (§10 AC4).
const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
});

export function formatPrice(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/**
 * El formulario trabaja en unidades con decimales y la BD en centavos enteros.
 * `Math.round` es obligatorio: `1299.99 * 100` da `129998.99999999999` (§10).
 */
export function unitsToCents(units: number): number {
  return Math.round(units * 100);
}

export function centsToUnits(cents: number): number {
  return cents / 100;
}
