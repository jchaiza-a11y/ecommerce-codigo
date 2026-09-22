import { createColumnHelper } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// La bitácora es la dueña de `formatDateTime`; se reutiliza en vez de escribir
// otro formateador que pueda divergir (012 §Reutilizar).
import { formatDateTime } from "@/modules/audit-logs/constants";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_VARIANTS,
} from "@/modules/orders/constants";
import type { AdminOrderListItem } from "@/modules/orders/schemas/admin-order.schema";
import { formatPrice } from "@/modules/products/constants";

const helper = createColumnHelper<DataTableFeatures, AdminOrderListItem>();

type AdminOrderColumnsOptions = {
  onSelect: (order: AdminOrderListItem) => void;
};

/**
 * Columnas de solo lectura: el estado del pedido lo gobierna el webhook de
 * Stripe (008), así que el panel no ofrece ninguna mutación (012 §Alcance).
 */
export function buildAdminOrderColumns({ onSelect }: AdminOrderColumnsOptions) {
  return helper.columns([
    helper.accessor("createdAt", {
      header: "Fecha",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
    helper.accessor((row) => row.customer.name ?? row.customer.email, {
      id: "customer",
      header: "Cliente",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.customer.name ?? "Sin nombre"}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.customer.email}
          </span>
        </div>
      ),
    }),
    helper.accessor("status", {
      header: "Estado",
      enableGlobalFilter: false,
      cell: (info) => (
        <Badge variant={ORDER_STATUS_VARIANTS[info.getValue()]}>
          {ORDER_STATUS_LABELS[info.getValue()]}
        </Badge>
      ),
    }),
    helper.accessor("itemCount", {
      header: "Líneas",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="tabular-nums">{info.getValue()}</span>
      ),
    }),
    helper.accessor("totalCents", {
      header: "Total",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="font-medium tabular-nums">
          {formatPrice(info.getValue())}
        </span>
      ),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(row.original)}
          >
            Ver detalle
          </Button>
        </div>
      ),
    }),
  ]);
}
