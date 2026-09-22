"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdjustStock } from "@/modules/inventory/hooks/use-inventory-mutations";
import {
  adjustStockSchema,
  type InventoryItem,
} from "@/modules/inventory/schemas/inventory.schema";

type StockAdjustCellProps = {
  item: InventoryItem;
};

/**
 * Reposición por fila (013 T19). El mismo `adjustStockSchema` que valida el
 * Route Handler decide aquí si el botón se habilita, así que una cantidad 0,
 * negativa, decimal o vacía no llega a salir del navegador (AC5) y el 400 del
 * servidor queda como segunda línea de defensa, no como la primera.
 *
 * Cada celda instancia su propia mutación: así el `isPending` deshabilita solo
 * la fila que se está reponiendo y no congela la tabla entera.
 */
export function StockAdjustCell({ item }: StockAdjustCellProps) {
  const [quantity, setQuantity] = useState("");
  const adjustStock = useAdjustStock();

  // `Number("")` y `Number(" ")` dan 0, que el schema rechaza por no ser
  // positivo: el caso vacío no necesita rama propia.
  const parsed = adjustStockSchema.safeParse({ quantity: Number(quantity) });
  const showError = quantity.trim().length > 0 && !parsed.success;

  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(event) => {
        event.preventDefault();

        if (!parsed.success || adjustStock.isPending) {
          return;
        }

        adjustStock.mutate(
          { productId: item.id, input: parsed.data },
          { onSuccess: () => setQuantity("") },
        );
      }}
    >
      <div className="flex items-center justify-end gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="h-8 w-20"
          placeholder="0"
          aria-label={`Unidades a reponer de ${item.name}`}
          aria-invalid={showError}
          value={quantity}
          disabled={adjustStock.isPending}
          onChange={(event) => setQuantity(event.target.value)}
        />

        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!parsed.success || adjustStock.isPending}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      {showError ? (
        <p className="text-xs text-destructive">
          {parsed.error.issues[0]?.message}
        </p>
      ) : null}
    </form>
  );
}
