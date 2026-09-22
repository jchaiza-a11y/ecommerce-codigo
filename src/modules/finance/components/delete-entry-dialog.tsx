"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteFinanceExpense } from "@/modules/finance/hooks/use-finance-expense-mutations";
import { useDeleteFinanceIncome } from "@/modules/finance/hooks/use-finance-income-mutations";
import { formatPrice } from "@/modules/products/constants";

export type FinanceEntryType = "income" | "expense";

/** Lo mínimo para identificar la entrada en el aviso; sirven las dos filas. */
type DeletableEntry = {
  id: string;
  amountCents: number;
  description: string | null;
};

type DeleteFinanceEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: DeletableEntry | null;
  type: FinanceEntryType;
};

const COPY: Record<FinanceEntryType, { title: string; noun: string }> = {
  income: { title: "Eliminar ingreso", noun: "el ingreso" },
  expense: { title: "Eliminar egreso", noun: "el egreso" },
};

/**
 * Confirmación de borrado compartida por los dos libros (016 T14): solo cambian
 * el sustantivo y la mutación, así que no hay dos diálogos casi idénticos.
 *
 * Los dos hooks se llaman siempre —son hooks, no pueden ir tras un `if`— y el
 * tipo decide cuál se usa.
 */
export function DeleteFinanceEntryDialog({
  open,
  onOpenChange,
  entry,
  type,
}: DeleteFinanceEntryDialogProps) {
  const incomeMutation = useDeleteFinanceIncome();
  const expenseMutation = useDeleteFinanceExpense();
  const mutation = type === "income" ? incomeMutation : expenseMutation;
  const { title, noun } = COPY[type];

  async function handleConfirm() {
    if (!entry) {
      return;
    }

    try {
      await mutation.mutateAsync(entry.id);
      onOpenChange(false);
    } catch {
      // El hook ya notificó el error por toast; el diálogo sigue abierto para
      // permitir reintentar.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará {noun}
            {entry ? ` de ${formatPrice(entry.amountCents)}` : ""}
            {entry?.description ? ` ("${entry.description}")` : ""} y dejará de
            contar en el Resumen. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending}
            onClick={(event) => {
              // Sin `preventDefault` Radix cierra el diálogo antes de que la
              // mutación resuelva, y un fallo pasaría desapercibido.
              event.preventDefault();
              void handleConfirm();
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
