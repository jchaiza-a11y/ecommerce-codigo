"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreateUserResponse } from "@/modules/users/types/user.types";

type TemporaryPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  created: CreateUserResponse | null;
};

/**
 * La contraseña temporal se muestra **una única vez** (003 §8.4): no se
 * persiste en ninguna tabla, no aparece en `audit_logs` y no se puede volver a
 * consultar. Si se pierde, hay que reiniciarla desde Clerk.
 */
export function TemporaryPasswordDialog({
  open,
  onOpenChange,
  created,
}: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!created) {
    return null;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.temporaryPassword);
      setCopied(true);
      toast.success("Contraseña copiada al portapapeles");
    } catch {
      toast.error("El navegador no permitió copiar. Selecciónala a mano.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contraseña temporal de {created.user.email}</DialogTitle>
          <DialogDescription>
            Entrégasela por un canal seguro. Se le pedirá cambiarla en su primer
            acceso.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
          <code className="flex-1 text-sm break-all">
            {created.temporaryPassword}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copy}
            aria-label="Copiar contraseña temporal"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>

        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          Esta es la única vez que se muestra. Al cerrar este diálogo no habrá
          forma de recuperarla.
        </p>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Ya la he guardado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
