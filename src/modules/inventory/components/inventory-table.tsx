"use client";

import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getApiErrorMessage } from "@/lib/api-error";
import { buildInventoryColumns } from "@/modules/inventory/components/inventory-columns";
import { isBelowThreshold } from "@/modules/inventory/constants";
import { useInventory } from "@/modules/inventory/hooks/use-inventory";
import type { InventoryItem } from "@/modules/inventory/schemas/inventory.schema";

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_INVENTORY: InventoryItem[] = [];

/**
 * Frontera de cliente de `/admin/inventory` (013 T22). El filtro "solo stock
 * bajo" recorta el array antes de entregárselo a `DataTable` en vez de usar un
 * `columnFilter`: el estado es derivado (stock vs. umbral) y no vive en ninguna
 * celda que la tabla pueda filtrar.
 */
export function InventoryTable() {
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const { data, isPending, isError, error, refetch, isFetching } =
    useInventory();

  const columns = useMemo(() => buildInventoryColumns(), []);

  const items = data ?? EMPTY_INVENTORY;
  const rows = useMemo(
    () =>
      onlyLowStock
        ? items.filter((item) =>
            isBelowThreshold(item.stock, item.lowStockThreshold),
          )
        : items,
    [items, onlyLowStock],
  );

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          No se pudo cargar el inventario
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {getApiErrorMessage(error, "Inténtalo de nuevo en unos momentos.")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Switch
          id="inventory-only-low-stock"
          checked={onlyLowStock}
          onCheckedChange={setOnlyLowStock}
        />
        <Label htmlFor="inventory-only-low-stock">Solo stock bajo</Label>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isPending}
        searchPlaceholder="Buscar por nombre, SKU o categoría..."
        emptyMessage={
          onlyLowStock
            ? "Ningún producto está por debajo de su umbral."
            : "Todavía no hay productos en el catálogo."
        }
      />
    </div>
  );
}
