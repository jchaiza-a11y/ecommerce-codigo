import type { Metadata } from "next";

import { can, requirePermissionInPage } from "@/lib/permissions";
import { IncomeTable } from "@/modules/finance/components/income-table";

export const metadata: Metadata = {
  title: "Ingresos",
  description: "Libro de ingresos: pedidos cobrados y altas manuales.",
};

/** Libro de ingresos (015 T18 · 016 T19). El `"use client"` vive en la tabla. */
export default async function FinanceIncomePage() {
  const user = await requirePermissionInPage("finance.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
        <p className="text-sm text-muted-foreground">
          Da de alta ingresos que no vienen de la tienda. Los derivados de un
          pedido los escribe el cobro y no se editan desde el panel.
        </p>
      </header>

      {/* Sin `finance.manage` la tabla ni ofrece el alta ni las acciones de
          fila; los endpoints lo vuelven a comprobar por su cuenta (AC8). */}
      <IncomeTable canManage={can("finance.manage", user)} />
    </div>
  );
}
