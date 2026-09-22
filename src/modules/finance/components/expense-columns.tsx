"use client";

import { createColumnHelper } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_ORIGIN_LABELS,
  formatDateTime,
  formatOrderReference,
} from "@/modules/finance/constants";
import type { FinanceExpenseListItem } from "@/modules/finance/types/finance.types";
import { formatPrice } from "@/modules/products/constants";

const helper = createColumnHelper<DataTableFeatures, FinanceExpenseListItem>();

/**
 * Concepto legible del movimiento: la descripción del alta manual o, en las
 * filas derivadas del pedido, su referencia corta.
 */
function toConcept(row: FinanceExpenseListItem): string {
  if (row.description) {
    return row.description;
  }

  return row.orderId ? formatOrderReference(row.orderId) : "—";
}

/**
 * Columnas de solo lectura del libro de egresos (015 T16). La categoría solo la
 * llevan los egresos manuales; los de pedido se clasifican por su origen, de ahí
 * el guion en esas filas.
 */
export function buildExpenseColumns() {
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
          {EXPENSE_ORIGIN_LABELS[info.getValue()]}
        </Badge>
      ),
    }),
    helper.accessor("category", {
      header: "Categoría",
      enableGlobalFilter: false,
      cell: (info) => {
        const category = info.getValue();

        return category ? (
          EXPENSE_CATEGORY_LABELS[category]
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
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
