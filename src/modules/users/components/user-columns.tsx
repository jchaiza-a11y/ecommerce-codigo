"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, ShieldCheck, UserCheck, UserX } from "lucide-react";

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
import { formatDate, getFullName } from "@/modules/users/constants";
import type { UserListItem } from "@/modules/users/types/user.types";

const helper = createColumnHelper<DataTableFeatures, UserListItem>();

type UserColumnActions = {
  onEdit: (user: UserListItem) => void;
  onAssignRoles: (user: UserListItem) => void;
  onToggleActive: (user: UserListItem) => void;
  /** Sin `users.deactivate` el toggle se muestra deshabilitado, no oculto. */
  canDeactivate: boolean;
};

export function buildUserColumns({
  onEdit,
  onAssignRoles,
  onToggleActive,
  canDeactivate,
}: UserColumnActions) {
  return helper.columns([
    helper.accessor((row) => getFullName(row), {
      id: "name",
      header: "Nombre",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    helper.accessor("email", {
      header: "Correo",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue()}</span>
      ),
    }),
    helper.accessor((row) => row.roles.map((role) => role.slug).join(" "), {
      id: "roles",
      header: "Roles",
      enableSorting: false,
      // El select entrega un slug; la fila puede tener varios.
      filterFn: (row, columnId, filterValue) =>
        String(row.getValue(columnId)).split(" ").includes(String(filterValue)),
      cell: ({ row }) => {
        const roles = row.original.roles;

        if (roles.length === 0) {
          return <span className="text-muted-foreground">Sin rol</span>;
        }

        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge key={role.slug} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </div>
        );
      },
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
      header: "Alta",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="text-muted-foreground">
          {formatDate(info.getValue())}
        </span>
      ),
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const user = row.original;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Acciones de ${user.email}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onEdit(user)}>
                  <Pencil className="size-4" />
                  Editar
                </DropdownMenuItem>
                {/* Abre el mismo diálogo, posicionado sobre la sección de
                    roles: el alta y la asignación comparten formulario. */}
                <DropdownMenuItem onSelect={() => onAssignRoles(user)}>
                  <ShieldCheck className="size-4" />
                  Asignar roles
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canDeactivate}
                  variant={user.isActive ? "destructive" : "default"}
                  onSelect={() => onToggleActive(user)}
                >
                  {user.isActive ? (
                    <UserX className="size-4" />
                  ) : (
                    <UserCheck className="size-4" />
                  )}
                  {user.isActive ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    }),
  ]);
}
