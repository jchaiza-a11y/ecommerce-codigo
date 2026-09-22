import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requirePermissionInPage } from "@/lib/permissions";
import { SummaryView } from "@/modules/finance/components/summary-view";
import { RANGE_DAYS } from "@/modules/finance/constants";

export const metadata: Metadata = {
  title: "Finanzas",
  description: `Ingresos, egresos y ganancia neta de los últimos ${RANGE_DAYS} días.`,
};

/**
 * Resumen financiero (015 T17). El `"use client"` queda contenido en
 * `SummaryView`.
 */
export default async function FinancePage() {
  // Segunda capa de defensa (003 §8.1): `proxy.ts` decide con los permisos
  // cacheados en el JWT, así que un permiso revocado en Postgres seguiría
  // pasando el filtro de ruta hasta que la sesión refresque el claim. Esto
  // revalida contra la base (AC7).
  await requirePermissionInPage("finance.view");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
          <p className="text-sm text-muted-foreground">
            Ingresos, egresos y ganancia neta de los últimos {RANGE_DAYS} días.
            Los movimientos los genera cada pedido pagado.
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/finance/income">Ver ingresos</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/finance/expenses">Ver egresos</Link>
          </Button>
        </div>
      </header>

      <SummaryView />
    </div>
  );
}
