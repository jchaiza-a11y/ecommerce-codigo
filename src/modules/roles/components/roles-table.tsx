"use client";

import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import {
  DataTable,
  type DataTableFeatures,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { getPermissionLabel } from "@/modules/roles/constants/permission-labels";
import { useRoles } from "@/modules/roles/hooks/use-roles";
import type { RoleWithPermissions } from "@/modules/roles/types/role.types";

const helper = createColumnHelper<DataTableFeatures, RoleWithPermissions>();

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_ROLES: RoleWithPermissions[] = [];

/**
 * Catálogo de solo lectura: los seis roles son de sistema y no se crean, editan
 * ni borran desde la UI (003 §8.10).
 */
export function RolesTable() {
  const { data, isPending, isError } = useRoles();

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Rol",
          cell: (info) => (
            <span className="font-medium whitespace-nowrap">
              {info.getValue()}
            </span>
          ),
        }),
        helper.accessor("description", {
          header: "Descripción",
          enableSorting: false,
          cell: (info) => (
            <span className="text-muted-foreground">
              {info.getValue() ?? "—"}
            </span>
          ),
        }),
        helper.accessor((row) => row.permissionCodes.join(" "), {
          id: "permissions",
          header: "Qué permite",
          enableSorting: false,
          cell: ({ row }) => {
            const codes = row.original.permissionCodes;

            if (codes.length === 0) {
              return (
                <span className="text-muted-foreground">
                  Sin acceso al panel de administración
                </span>
              );
            }

            return (
              <ul className="flex flex-col gap-1">
                {/* En lenguaje llano, nunca el código crudo (AC13). */}
                {codes.map((code) => (
                  <li key={code} className="text-sm">
                    {getPermissionLabel(code)}
                  </li>
                ))}
              </ul>
            );
          },
        }),
        helper.accessor("isSystem", {
          header: "Tipo",
          enableGlobalFilter: false,
          enableSorting: false,
          cell: (info) => (
            <Badge variant={info.getValue() ? "secondary" : "outline"}>
              {info.getValue() ? "De sistema" : "Personalizado"}
            </Badge>
          ),
        }),
      ]),
    [],
  );

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          No se pudieron cargar los roles
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Inténtalo de nuevo en unos momentos.
        </p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data ?? EMPTY_ROLES}
      isLoading={isPending}
      searchPlaceholder="Buscar rol..."
      emptyMessage="No hay roles sembrados. Ejecuta npm run db:seed."
    />
  );
}
