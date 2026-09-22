import type { Metadata } from "next";

import { can, requirePermissionInPage } from "@/lib/permissions";
import { ExpensesTable } from "@/modules/finance/components/expenses-table";

export const metadata: Metadata = {
  title: "Egresos",
  description: "Libro de egresos: costo de venta, envío y altas manuales.",
};

/** Libro de egresos (015 T19 · 016 T19). El `"use client"` vive en la tabla. */
export default async function FinanceExpensesPage() {
  const user = await requirePermissionInPage("finance.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Egresos</h1>
        <p className="text-sm text-muted-foreground">
          Da de alta los gastos del negocio. El costo de venta y el envío los
          escribe cada pedido pagado y no se editan desde el panel.
        </p>
      </header>

      {/* Sin `finance.manage` la tabla ni ofrece el alta ni las acciones de
          fila; los endpoints lo vuelven a comprobar por su cuenta (AC8). */}
      <ExpensesTable canManage={can("finance.manage", user)} />
    </div>
  );
}
