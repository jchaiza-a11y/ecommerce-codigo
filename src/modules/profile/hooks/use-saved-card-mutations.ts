"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";
import { savedCardKeys } from "@/modules/profile/constants";
import {
  confirmSavedCard,
  createCardSetupSession,
  deleteSavedCard,
} from "@/modules/profile/services/saved-card.service";

/**
 * No invalida nada: crear la sesión no cambia ningún dato en caché, solo
 * produce la `url` hospedada a la que redirigir (mismo patrón que
 * `useCreateCheckoutSession`).
 */
export function useCreateCardSetupSession() {
  return useMutation({
    mutationFn: createCardSetupSession,
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "No se pudo abrir el formulario de Stripe"),
      );
    },
  });
}

/**
 * Confirma el retorno de Stripe. El fallo no se traga, pero tampoco se cuenta
 * como definitivo: el webhook guarda la misma tarjeta por su cuenta (AC4), así
 * que se refresca la lista igualmente y el aviso remite a ella.
 */
export function useConfirmSavedCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (setupSessionId: string) => confirmSavedCard(setupSessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: savedCardKeys.all });
      toast.success("Tarjeta guardada");
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: savedCardKeys.all });
      console.error("useConfirmSavedCard", error);
      toast.warning(
        "No pudimos confirmar la tarjeta al volver de Stripe. Si no aparece en la lista, vuelve a intentarlo.",
      );
    },
  });
}

export function useDeleteSavedCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSavedCard(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: savedCardKeys.all });
      toast.success("Tarjeta eliminada");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar la tarjeta"));
    },
  });
}
