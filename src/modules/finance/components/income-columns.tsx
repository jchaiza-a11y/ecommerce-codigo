"use client";

import { createColumnHelper } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  formatOrderReference,
  INCOME_ORIGIN_LABELS,
} from "@/modules/finance/constants";
import type { FinanceIncomeListItem } from "@/modules/finance/types/finance.types";
import { formatPrice } from "@/modules/products/constants";

const helper = createColumnHelper<DataTableFeatures, FinanceIncomeListItem>();

/**
 * Concepto legible del movimiento: la descripción del alta manual o, en las
 * filas derivadas del pedido, su referencia corta.
 */
function toConcept(row: FinanceIncomeListItem): string {
  if (row.description) {
    return row.description;
  }

  return row.orderId ? formatOrderReference(row.orderId) : "—";
}

/**
 * Columnas de solo lectura del libro de ingresos (015 T15): las filas de origen
 * `order` son derivadas del pedido y no se editan, así que la tabla no ofrece
 * ninguna acción.
 */
export function buildIncomeColumns() {
  return helper.columns([
    helper.accessor("occurredAt", {
      header: "Fecha",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
    helper.accessor("origin", {
      header: "Origen",
      enableGlobalFilter: false,
      filterFn: (row, columnId, filterValue) =>
        row.getValue(columnId) === filterValue,
      cell: (info) => (
        <Badge variant="secondary">
          {INCOME_ORIGIN_LABELS[info.getValue()]}
        </Badge>
      ),
    }),
    helper.accessor(toConcept, {
      id: "concept",
      header: "Concepto",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    helper.accessor("amountCents", {
      header: "Monto",
      enableGlobalFilter: false,
      cell: (info) => (
        // `tabular-nums` sí aquí: es una columna de cifras que deben alinearse
        // verticalmente entre filas.
        <span className="block text-right font-mono tabular-nums">
          {formatPrice(info.getValue())}
        </span>
      ),
    }),
  ]);
}
