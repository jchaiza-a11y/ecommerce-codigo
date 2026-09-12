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
import { formatPrice } from "@/modules/products/constants";
import type { ProductListItem } from "@/modules/products/types/product.types";

const helper = createColumnHelper<DataTableFeatures, ProductListItem>();

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type ProductColumnActions = {
  onEdit: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
};

export function buildProductColumns({
  onEdit,
  onDelete,
}: ProductColumnActions) {
  return helper.columns([
    helper.accessor("name", {
      header: "Nombre",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    helper.accessor("sku", {
      header: "SKU",
      cell: (info) => (
        <code className="text-xs text-muted-foreground">{info.getValue()}</code>
      ),
    }),
    helper.accessor("categoryName", {
      header: "Categoría",
      // El select entrega el nombre exacto de la categoría elegida.
      filterFn: (row, columnId, filterValue) =>
        row.getValue(columnId) === filterValue,
    }),
    helper.accessor("priceCents", {
      header: "Precio",
      enableGlobalFilter: false,
      cell: (info) => {
        const { compareAtPriceCents } = info.row.original;
        const priceCents = info.getValue();
        // Sin este guard un "descuento" mal cargado pintaría una oferta falsa:
        // la coherencia no se valida en Zod (§8.5).
        const showCompare =
          compareAtPriceCents !== null && compareAtPriceCents > priceCents;

        return (
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-medium">{formatPrice(priceCents)}</span>
            {showCompare ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(compareAtPriceCents)}
              </span>
            ) : null}
          </div>
        );
      },
    }),
    helper.accessor("stock", {
      header: "Stock",
      enableGlobalFilter: false,
    }),
    helper.accessor("isActive", {
      header: "Estado",
      enableGlobalFilter: false,
      enableSorting: false,
      // El select entrega strings; la fila guarda un boolean.
      filterFn: (row, columnId, filterValue) =>
        String(row.getValue(columnId)) === filterValue,
      cell: (info) => (
        <Badge variant={info.getValue() ? "default" : "secondary"}>
          {info.getValue() ? "Activo" : "Inactivo"}
        </Badge>
      ),
    }),
    helper.accessor("createdAt", {
      header: "Creado",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="text-muted-foreground">
          {dateFormatter.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const product = row.original;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Acciones de ${product.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onEdit(product)}>
                  <Pencil className="size-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(product)}
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
  ]);
}
