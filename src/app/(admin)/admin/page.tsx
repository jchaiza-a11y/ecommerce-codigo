import type { Metadata } from "next";

import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import { RANGE_DAYS } from "@/modules/dashboard/constants";

export const metadata: Metadata = {
  title: "Dashboard",
  description: `Métricas de venta de los últimos ${RANGE_DAYS} días.`,
};

/**
 * Raíz del panel (011 T21). No repite el guard de `dashboard.view`: `proxy.ts`
 * ya lo exige en esta ruta y, a diferencia del resto de páginas admin, aquí no
 * puede limitarse a cortar el render — sin el permiso redirige a la primera
 * sección permitida (003 §8.7), y duplicar la comprobación con
 * `requirePermissionInPage` mandaría a `/admin/forbidden` a un rol que sí tiene
 * panel. El `"use client"` queda contenido en `DashboardView`.
 */
export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Ventas, pedidos y stock de los últimos {RANGE_DAYS} días. Se actualiza
          solo mientras la pestaña esté visible.
        </p>
      </header>

      <DashboardView />
    </div>
  );
}
