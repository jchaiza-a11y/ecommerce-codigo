"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type ExpenseColumnOptions = {
  /** Sin `finance.manage` la columna de acciones ni se construye (AC8). */
  canManage: boolean;
  onEdit: (entry: FinanceExpenseListItem) => void;
  onDelete: (entry: FinanceExpenseListItem) => void;
};

/**
 * Columnas del libro de egresos (015 T16 · 016 T16). La categoría solo la
 * llevan los egresos manuales; los de pedido se clasifican por su origen, de ahí
 * el guion en esas filas, y tampoco ofrecen acciones.
 */
export function buildExpenseColumns({
  canManage,
  onEdit,
  onDelete,
}: ExpenseColumnOptions) {
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
    ...(canManage
      ? [
          helper.display({
            id: "actions",
            header: "",
            cell: ({ row }) => {
              const entry = row.original;

              // El costo de venta y el envío los escribe el pedido: esas filas
              // no ofrecen nada (AC5). El backend lo vuelve a impedir aparte.
              if (entry.origin !== "manual") {
                return null;
              }

              return (
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Acciones del egreso"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => onEdit(entry)}>
                        <Pencil className="size-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(entry)}
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            },
          }),
        ]
      : []),
  ]);
}
