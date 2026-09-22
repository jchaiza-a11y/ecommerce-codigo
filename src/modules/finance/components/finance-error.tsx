"use client";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";

type FinanceErrorProps = {
  title: string;
  error: unknown;
  onRetry: () => void;
  /** Deshabilita el botón mientras el reintento está en vuelo. */
  isRetrying: boolean;
};

/**
 * Aviso de error de red con reintento (015 AC8). Compartido por las tres
 * vistas del módulo: el mensaje de la API es el mismo contrato en todas.
 */
export function FinanceError({
  title,
  error,
  onRetry,
  isRetrying,
}: FinanceErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-6"
    >
      <p className="font-medium text-destructive">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {getApiErrorMessage(error, "Inténtalo de nuevo en unos momentos.")}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={onRetry}
        disabled={isRetrying}
      >
        Reintentar
      </Button>
    </div>
  );
}
