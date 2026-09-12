"use client";

import { useState } from "react";
import { CreditCard, Loader2, Trash2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCardExpiry,
  formatCardLabel,
} from "@/modules/profile/constants";
import type { SavedCard } from "@/modules/profile/schemas/saved-card.schema";

type SavedCardItemProps = {
  card: SavedCard;
  /** Devuelve la promesa de la mutación: el diálogo la espera antes de cerrar. */
  onDelete: () => Promise<void>;
  isDeleting: boolean;
};

/**
 * Fila presentacional de "Mis tarjetas" (010 T15). No consulta ni muta nada:
 * recibe la tarjeta ya serializada y delega el borrado en la sección.
 *
 * Solo hay marca y `•••• last4` porque es todo lo que Stripe devuelve: el PAN y
 * el BIN no salen nunca de su lado (010 §Decisión 1).
 */
export function SavedCardItem({
  card,
  onDelete,
  isDeleting,
}: SavedCardItemProps) {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const label = formatCardLabel(card);

  async function handleConfirm() {
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch {
      // El hook ya avisó por toast; el diálogo sigue abierto para reintentar.
    }
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <CreditCard className="size-5" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            Caduca {formatCardExpiry(card.expMonth, card.expYear)}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={`Eliminar ${label}`}
          disabled={isDeleting}
          onClick={() => setConfirmOpen(true)}
        >
          {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </CardContent>

      <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tarjeta</AlertDialogTitle>
            <AlertDialogDescription>
              {label} dejará de estar disponible al pagar. Podrás volver a
              guardarla cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
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
    </Card>
  );
}
