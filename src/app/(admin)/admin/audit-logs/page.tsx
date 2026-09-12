import type { Metadata } from "next";

import { requirePermissionInPage } from "@/lib/permissions";
import { AuditLogsTable } from "@/modules/audit-logs/components/audit-logs-table";

export const metadata: Metadata = {
  title: "Auditoría",
  description: "Bitácora inmutable de las mutaciones relevantes.",
};

/** Destino único del rol `audit` (003 §8.7). */
export default async function AuditLogsPage() {
  await requirePermissionInPage("audit_logs.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Registro de solo lectura de quién hizo qué y cuándo. No se puede
          editar ni borrar.
        </p>
      </header>

      <AuditLogsTable />
    </div>
  );
}
