import type { Metadata } from "next";

import { requirePermissionInPage } from "@/lib/permissions";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import { RANGE_DAYS } from "@/modules/dashboard/constants";

export const metadata: Metadata = {
  title: "Dashboard",
  description: `Métricas de venta de los últimos ${RANGE_DAYS} días.`,
};

/**
 * Raíz del panel (011 T21). El `"use client"` queda contenido en
 * `DashboardView`.
 */
export default async function AdminDashboardPage() {
  // Segunda capa de defensa, igual que en las demás páginas que muestran datos
  // protegidos por permiso (003 §8.1): `proxy.ts` decide con los permisos
  // cacheados en el JWT, así que un rol revocado en Postgres seguiría pasando
  // el filtro de ruta hasta que la sesión refresque el claim. Esto revalida
  // contra la base. El desvío a la primera sección permitida para quien no
  // tiene `dashboard.view` (§8.7) ocurre antes, en el middleware, y no llega
  // hasta aquí.
  await requirePermissionInPage("dashboard.view");

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
