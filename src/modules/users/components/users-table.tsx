"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { DataTable, type DataTableFilter } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/modules/roles/hooks/use-roles";
import { buildUserColumns } from "@/modules/users/components/user-columns";
import { TemporaryPasswordDialog } from "@/modules/users/components/temporary-password-dialog";
import { UserFormDialog } from "@/modules/users/components/user-form-dialog";
import { USER_STATUS_OPTIONS } from "@/modules/users/constants";
import { useUpdateUser } from "@/modules/users/hooks/use-user-mutations";
import { useUsers } from "@/modules/users/hooks/use-users";
import { getApiErrorMessage } from "@/modules/users/services/user.service";
import type {
  CreateUserResponse,
  UserListItem,
} from "@/modules/users/types/user.types";

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_USERS: UserListItem[] = [];

type UsersTableProps = {
  /** §8.3: solo un `super_admin` puede conceder `super_admin` o `admin`. */
  canAssignPrivilegedRoles: boolean;
  canCreate: boolean;
  canDeactivate: boolean;
};

export function UsersTable({
  canAssignPrivilegedRoles,
  canCreate,
  canDeactivate,
}: UsersTableProps) {
  const { data, isPending, isError, error } = useUsers();
  const rolesQuery = useRoles();
  const updateMutation = useUpdateUser();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [created, setCreated] = useState<CreateUserResponse | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const columns = useMemo(
    () =>
      buildUserColumns({
        canDeactivate,
        onEdit: (user) => {
          setEditing(user);
          setFormOpen(true);
        },
        onAssignRoles: (user) => {
          setEditing(user);
          setFormOpen(true);
        },
        onToggleActive: (user) => {
          updateMutation.mutate({
            id: user.id,
            input: { isActive: !user.isActive },
          });
        },
      }),
    [canDeactivate, updateMutation],
  );

  const roles = rolesQuery.data;

  const filters = useMemo<DataTableFilter[]>(
    () => [
      { columnId: "isActive", label: "Estado", options: USER_STATUS_OPTIONS },
      {
        columnId: "roles",
        label: "Rol",
        options: (roles ?? []).map((role) => ({
          label: role.name,
          value: role.slug,
        })),
      },
    ],
    [roles],
  );

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          No se pudieron cargar los usuarios
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {getApiErrorMessage(error, "Inténtalo de nuevo en unos momentos.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={data ?? EMPTY_USERS}
        isLoading={isPending}
        searchPlaceholder="Buscar por nombre o correo..."
        filters={filters}
        emptyMessage="Todavía no hay usuarios sincronizados desde Clerk."
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        canAssignPrivilegedRoles={canAssignPrivilegedRoles}
        onCreated={(response) => {
          setCreated(response);
          setPasswordOpen(true);
        }}
      />

      <TemporaryPasswordDialog
        open={passwordOpen}
        onOpenChange={(open) => {
          setPasswordOpen(open);

          // Al cerrar se descarta de memoria: no hay forma de volver a verla.
          if (!open) {
            setCreated(null);
          }
        }}
        created={created}
      />
    </div>
  );
}
