"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";
import type { CheckoutSessionInput } from "@/modules/checkout/schemas/checkout.schema";
import { createCheckoutSession } from "@/modules/checkout/services/checkout.service";

/**
 * No invalida ninguna query: crear la sesión no cambia ningún dato en caché,
 * solo produce la `url` a la que redirigir. El 409 de stock o de producto
 * retirado llega ya redactado desde el servidor y se muestra tal cual.
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (input: CheckoutSessionInput) => createCheckoutSession(input),
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo iniciar el pago"));
    },
  });
}
