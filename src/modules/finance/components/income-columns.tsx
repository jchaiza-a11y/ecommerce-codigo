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

type IncomeColumnOptions = {
  /** Sin `finance.manage` la columna de acciones ni se construye (AC8). */
  canManage: boolean;
  onEdit: (entry: FinanceIncomeListItem) => void;
  onDelete: (entry: FinanceIncomeListItem) => void;
};

/**
 * Columnas del libro de ingresos (015 T15 · 016 T15). Las filas de origen
 * `order` son derivadas del pedido y no se editan: solo las manuales muestran
 * acciones, y solo para quien puede gestionarlas.
 */
export function buildIncomeColumns({
  canManage,
  onEdit,
  onDelete,
}: IncomeColumnOptions) {
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
    ...(canManage
      ? [
          helper.display({
            id: "actions",
            header: "",
            cell: ({ row }) => {
              const entry = row.original;

              // Un ingreso de pedido no se edita ni se borra: la fila no ofrece
              // nada (AC5). El backend lo vuelve a impedir por su cuenta.
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
                        aria-label="Acciones del ingreso"
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
