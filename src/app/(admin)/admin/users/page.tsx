import type { Metadata } from "next";

import { can, requirePermissionInPage } from "@/lib/permissions";
import { SUPER_ADMIN_ROLE_SLUG } from "@/modules/roles/constants";
import { UsersTable } from "@/modules/users/components/users-table";

export const metadata: Metadata = {
  title: "Usuarios",
  description: "Administra las cuentas y los roles de la aplicación.",
};

export default async function UsersPage() {
  // Segunda capa de defensa: `proxy.ts` ya filtró por ruta, pero la página no
  // confía en el caché de permisos del JWT (003 §8.1).
  const user = await requirePermissionInPage("users.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Da de alta cuentas, revisa su estado y ajusta los roles con los que
          acceden al panel.
        </p>
      </header>

      <UsersTable
        canCreate={can("users.create", user)}
        canDeactivate={can("users.deactivate", user)}
        // Excepción documentada en §8.3: la jerarquía de asignación no se puede
        // expresar con un `permission.code`.
        canAssignPrivilegedRoles={user.roles.some(
          (role) => role.slug === SUPER_ADMIN_ROLE_SLUG,
        )}
      />
    </div>
  );
}
