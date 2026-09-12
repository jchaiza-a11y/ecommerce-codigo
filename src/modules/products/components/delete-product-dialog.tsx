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
import { useDeleteProduct } from "@/modules/products/hooks/use-product-mutations";
import type { ProductListItem } from "@/modules/products/types/product.types";

type DeleteProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductListItem | null;
};

export function DeleteProductDialog({
  open,
  onOpenChange,
  product,
}: DeleteProductDialogProps) {
  const deleteMutation = useDeleteProduct();

  async function handleConfirm() {
    if (!product) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(product.id);
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
          <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
          {/* Es un soft delete (§8.4): el texto no promete un borrado
              definitivo, solo la retirada del catálogo. */}
          <AlertDialogDescription>
            El producto{product ? ` "${product.name}"` : ""} dejará de estar
            disponible y desaparecerá del listado. Sus pedidos y su histórico se
            conservan.
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
