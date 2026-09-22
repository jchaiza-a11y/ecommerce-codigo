/**
 * IGV (impuesto general a las ventas) **ya incluido** en el precio: los importes
 * del ledger son lo efectivamente cobrado al cliente, así que el impuesto no se
 * suma encima, se desglosa de dentro.
 */
export const IGV_RATE = 0.18;

/**
 * Parte del importe bruto que corresponde al IGV: `total - total / 1.18`.
 *
 * Informativo (015 AC2): NO se resta de la ganancia neta, que sigue siendo
 * ingresos − egresos. Devuelve centavos enteros — redondear aquí, y una sola
 * vez, evita que el importe se arrastre con decimales (CLAUDE.md §6).
 */
export function estimateIgvCents(grossAmountCents: number): number {
  if (grossAmountCents <= 0) {
    return 0;
  }

  return Math.round(grossAmountCents - grossAmountCents / (1 + IGV_RATE));
}
