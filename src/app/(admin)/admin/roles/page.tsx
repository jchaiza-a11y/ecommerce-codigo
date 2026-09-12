import type { Metadata } from "next";

import { requirePermissionInPage } from "@/lib/permissions";
import { RolesTable } from "@/modules/roles/components/roles-table";

export const metadata: Metadata = {
  title: "Roles",
  description: "Catálogo de roles del sistema y lo que permite cada uno.",
};

export default async function RolesPage() {
  await requirePermissionInPage("roles.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de solo lectura. Los roles son de sistema: se asignan desde
          la ficha de cada usuario, pero no se crean ni se editan aquí.
        </p>
      </header>

      <RolesTable />
    </div>
  );
}
