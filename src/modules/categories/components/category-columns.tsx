"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/components/shared/data-table";
import type { Category } from "@/modules/categories/types/category.types";

const helper = createColumnHelper<DataTableFeatures, Category>();

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type CategoryColumnActions = {
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
};

export function buildCategoryColumns({
  onEdit,
  onDelete,
}: CategoryColumnActions) {
  return helper.columns([
    helper.accessor("name", {
      header: "Nombre",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    helper.accessor("slug", {
      header: "Slug",
      cell: (info) => (
        <code className="text-xs text-muted-foreground">{info.getValue()}</code>
      ),
    }),
    helper.accessor("sortOrder", {
      header: "Orden",
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
          {info.getValue() ? "Activa" : "Inactiva"}
        </Badge>
      ),
    }),
    helper.accessor("createdAt", {
      header: "Creada",
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
        const category = row.original;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Acciones de ${category.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onEdit(category)}>
                  <Pencil className="size-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(category)}
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
