"use client";

import { createColumnHelper } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { StockAdjustCell } from "@/modules/inventory/components/stock-adjust-cell";
import { ThresholdCell } from "@/modules/inventory/components/threshold-cell";
import {
  getStockStatus,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_VARIANTS,
} from "@/modules/inventory/constants";
import type { InventoryItem } from "@/modules/inventory/schemas/inventory.schema";

const helper = createColumnHelper<DataTableFeatures, InventoryItem>();

/**
 * Columnas de `/admin/inventory` (013 T21). La tabla llega ya ordenada por
 * stock ascendente desde el repositorio (`DataTable` no admite
 * `initialSorting`), así que aquí no se fija ningún orden por defecto.
 */
export function buildInventoryColumns() {
  return helper.columns([
    helper.accessor("name", {
      header: "Producto",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{info.getValue()}</span>
          {/* Un producto inactivo no se vende, pero sí se repone: conviene
              saberlo antes de pedir unidades. */}
          {info.row.original.isActive ? null : (
            <Badge variant="outline">Inactivo</Badge>
          )}
        </div>
      ),
    }),
    helper.accessor("sku", {
      header: "SKU",
      cell: (info) => (
        <code className="text-xs text-muted-foreground">{info.getValue()}</code>
      ),
    }),
    helper.accessor("categoryName", {
      header: "Categoría",
    }),
    helper.accessor("stock", {
      header: "Stock",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="tabular-nums font-medium">{info.getValue()}</span>
      ),
    }),
    helper.accessor("lowStockThreshold", {
      header: "Umbral",
      enableGlobalFilter: false,
      cell: (info) => <ThresholdCell item={info.row.original} />,
    }),
    // Estado y reposición son columnas derivadas: no existe ninguna celda de
    // `InventoryItem` detrás, así que no se ordenan ni se buscan.
    helper.display({
      id: "status",
      header: "Estado",
      cell: ({ row }) => {
        const { stock, lowStockThreshold } = row.original;
        const status = getStockStatus(stock, lowStockThreshold);

        return (
          <Badge variant={STOCK_STATUS_VARIANTS[status]}>
            {STOCK_STATUS_LABELS[status]}
          </Badge>
        );
      },
    }),
    helper.display({
      id: "adjust",
      header: "Reposición",
      cell: ({ row }) => <StockAdjustCell item={row.original} />,
    }),
  ]);
}
