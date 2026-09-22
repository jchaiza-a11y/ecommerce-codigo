import type { Metadata } from "next";

import { requirePermissionInPage } from "@/lib/permissions";
import { IncomeTable } from "@/modules/finance/components/income-table";

export const metadata: Metadata = {
  title: "Ingresos",
  description: "Libro de ingresos: pedidos cobrados y altas manuales.",
};

/** Libro de ingresos (015 T18). El `"use client"` vive en `IncomeTable`. */
export default async function FinanceIncomePage() {
  await requirePermissionInPage("finance.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
        <p className="text-sm text-muted-foreground">
          Registro de solo lectura. Los ingresos derivados de un pedido los
          escribe el cobro y no se editan desde el panel.
        </p>
      </header>

      <IncomeTable />
    </div>
  );
}
