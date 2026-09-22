"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateLowStockThreshold } from "@/modules/inventory/hooks/use-inventory-mutations";
import {
  updateThresholdSchema,
  type InventoryItem,
} from "@/modules/inventory/schemas/inventory.schema";

type ThresholdCellProps = {
  item: InventoryItem;
};

/**
 * Umbral editable en línea (013 T20): hasta 011 no había ninguna UI capaz de
 * cambiarlo. En reposo es texto; al entrar en edición valida con el mismo
 * `updateThresholdSchema` del Route Handler, así que un decimal o un negativo
 * no llegan a la red (AC6).
 */
export function ThresholdCell({ item }: ThresholdCellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const updateThreshold = useUpdateLowStockThreshold();

  if (draft === null) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="tabular-nums">{item.lowStockThreshold}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Editar umbral de ${item.name}`}
          onClick={() => setDraft(String(item.lowStockThreshold))}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    );
  }

  // Un input vaciado no es "0": sin esta distinción, borrar el campo por
  // error confirmaría un umbral 0 en silencio (Number("") === 0 es válido
  // para el schema).
  const isEmpty = draft.trim() === "";
  const parsed = updateThresholdSchema.safeParse({ threshold: Number(draft) });
  const isValid = !isEmpty && parsed.success;
  const showError = !isValid;
  const errorMessage = isEmpty
    ? "Ingresá un umbral"
    : !parsed.success
      ? parsed.error.issues[0]?.message
      : undefined;

  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(event) => {
        event.preventDefault();

        if (isEmpty || !parsed.success || updateThreshold.isPending) {
          return;
        }

        // Confirmar sin cambiar nada no merece una fila en la bitácora.
        if (parsed.data.threshold === item.lowStockThreshold) {
          setDraft(null);

          return;
        }

        updateThreshold.mutate(
          { productId: item.id, input: parsed.data },
          { onSuccess: () => setDraft(null) },
        );
      }}
    >
      <div className="flex items-center justify-end gap-1">
        <Input
          autoFocus
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className="h-8 w-20"
          aria-label={`Umbral de ${item.name}`}
          aria-invalid={showError}
          value={draft}
          disabled={updateThreshold.isPending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(null);
            }
          }}
        />

        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Guardar umbral"
          disabled={!isValid || updateThreshold.isPending}
        >
          <Check className="size-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Cancelar"
          disabled={updateThreshold.isPending}
          onClick={() => setDraft(null)}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {showError ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </form>
  );
}
