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
import { useDeleteCategory } from "@/modules/categories/hooks/use-category-mutations";
import type { Category } from "@/modules/categories/types/category.types";

type DeleteCategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
};

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
}: DeleteCategoryDialogProps) {
  const deleteMutation = useDeleteCategory();

  async function handleConfirm() {
    if (!category) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(category.id);
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
          <AlertDialogTitle>Eliminar categoría</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará permanentemente la categoría
            {category ? ` "${category.name}"` : ""}. Esta acción no se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteMutation.isPending}
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
