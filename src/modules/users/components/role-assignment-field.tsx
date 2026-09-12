"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { isPrivilegedRoleSlug } from "@/modules/roles/constants";
import { getPermissionLabel } from "@/modules/roles/constants/permission-labels";
import { useRoles } from "@/modules/roles/hooks/use-roles";
import type { RoleWithPermissions } from "@/modules/roles/types/role.types";

const SKELETON_ROWS = 4;

type RoleAssignmentFieldProps = {
  value: string[];
  onChange: (roleSlugs: string[]) => void;
  /** §8.3: solo un `super_admin` ve y concede `super_admin` / `admin`. */
  canAssignPrivilegedRoles: boolean;
  disabled?: boolean;
};

function RolePermissionsPopover({ role }: { role: RoleWithPermissions }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2">
          <Info className="size-3.5" />
          Ver qué incluye este rol
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-sm font-medium">{role.name}</p>
        {role.permissionCodes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Este rol no da acceso a ninguna sección de administración.
          </p>
        ) : (
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
            {/* En lenguaje llano, nunca el código crudo (AC13). */}
            {role.permissionCodes.map((code) => (
              <li key={code}>{getPermissionLabel(code)}</li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function RoleAssignmentField({
  value,
  onChange,
  canAssignPrivilegedRoles,
  disabled = false,
}: RoleAssignmentFieldProps) {
  const { data, isPending, isError } = useRoles();

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar los roles. Cierra el diálogo e inténtalo de nuevo.
      </p>
    );
  }

  const roles = canAssignPrivilegedRoles
    ? data
    : data.filter((role) => !isPrivilegedRoleSlug(role.slug));

  if (roles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay roles que puedas asignar.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y rounded-md border">
      {roles.map((role) => {
        const checked = value.includes(role.slug);
        const switchId = `role-${role.slug}`;

        return (
          <div
            key={role.slug}
            className="flex items-start justify-between gap-4 p-3"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={switchId} className="text-sm font-medium">
                {role.name}
              </label>
              {role.description ? (
                <p className="text-sm text-muted-foreground">
                  {role.description}
                </p>
              ) : null}
              <div>
                <RolePermissionsPopover role={role} />
              </div>
            </div>

            <Switch
              id={switchId}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => {
                onChange(
                  next
                    ? [...value, role.slug]
                    : value.filter((slug) => slug !== role.slug),
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
