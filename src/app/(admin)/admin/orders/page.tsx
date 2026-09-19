import type { Metadata } from "next";

import { requirePermissionInPage } from "@/lib/permissions";
import { AdminOrdersTable } from "@/modules/orders/components/admin-orders-table";
import { DEFAULT_RANGE_DAYS } from "@/modules/orders/schemas/admin-order.schema";

export const metadata: Metadata = {
  title: "Pedidos",
  description: "Listado de pedidos con filtros por fecha, estado y cliente.",
};

/**
 * Guard de página además del de `proxy.ts` y del de cada handler: la
 * navegación directa no debe depender solo del mapa de rutas (003 §8).
 */
export default async function AdminOrdersPage() {
  await requirePermissionInPage("orders.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Consulta de solo lectura: el estado de un pedido lo gobierna el pago
          en Stripe. Sin filtro de fechas se muestran los últimos{" "}
          {DEFAULT_RANGE_DAYS} días.
        </p>
      </header>

      <AdminOrdersTable />
    </div>
  );
}
