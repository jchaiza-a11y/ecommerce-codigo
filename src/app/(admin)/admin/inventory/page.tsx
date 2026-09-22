import type { Metadata } from "next";

import { requirePermissionInPage } from "@/lib/permissions";
import { InventoryTable } from "@/modules/inventory/components/inventory-table";

export const metadata: Metadata = {
  title: "Inventario",
  description: "Repón stock y ajusta el umbral de alerta de cada producto.",
};

/**
 * `products.view` deja entrar y ver la tabla; reponer y cambiar el umbral
 * exigen `products.update` y lo verifican los Route Handlers (013 AC10/AC11).
 * El guard de página duplica al de `proxy.ts` a propósito: una navegación
 * cliente no vuelve a pasar por el proxy.
 */
export default async function InventoryPage() {
  await requirePermissionInPage("products.view");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Productos ordenados por stock: los agotados y los que están bajo
          mínimos encabezan la lista. Las unidades que agregues se suman al
          stock actual.
        </p>
      </header>

      <InventoryTable />
    </div>
  );
}
