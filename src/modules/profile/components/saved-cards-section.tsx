"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { AccountEmptySection } from "@/modules/profile/components/account-empty-section";
import { SavedCardItem } from "@/modules/profile/components/saved-card-item";
import {
  useConfirmSavedCard,
  useCreateCardSetupSession,
  useDeleteSavedCard,
} from "@/modules/profile/hooks/use-saved-card-mutations";
import { useSavedCards } from "@/modules/profile/hooks/use-saved-cards";

/** Url limpia a la que se vuelve tras confirmar la sesión de setup (AC3). */
const CARDS_TAB_URL = "/account?tab=cards";

type SavedCardsSectionProps = {
  /**
   * `session_id` de la url de retorno de Stripe. Llega como prop desde la
   * página —que ya lee `searchParams`— en vez de por `useSearchParams`: así
   * esta sección no obliga a envolver el árbol en un `Suspense`.
   */
  setupSessionId: string | null;
};

function SavedCardsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {[0, 1].map((row) => (
        <Skeleton key={row} className="h-18 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Frontera de cliente de "Mis tarjetas" (010 T16): concentra las mutaciones y
 * la confirmación del retorno de Stripe; las filas son presentacionales.
 */
export function SavedCardsSection({ setupSessionId }: SavedCardsSectionProps) {
  const router = useRouter();
  const cardsQuery = useSavedCards();
  const setupMutation = useCreateCardSetupSession();
  const confirmMutation = useConfirmSavedCard();
  const deleteMutation = useDeleteSavedCard();

  const confirmedSessionId = useRef<string | null>(null);
  const { mutate: confirmCard } = confirmMutation;

  useEffect(() => {
    if (!setupSessionId || confirmedSessionId.current === setupSessionId) {
      return;
    }

    // El montaje doble del modo estricto reentraría aquí: la sesión ya
    // atendida se marca antes de mutar, no después de responder.
    confirmedSessionId.current = setupSessionId;

    confirmCard(setupSessionId, {
      // Se limpia la url pase lo que pase: reintentar con el mismo `session_id`
      // en la barra no aportaría nada, y el webhook cubre el fallo (AC4).
      onSettled: () => router.replace(CARDS_TAB_URL),
    });
  }, [confirmCard, router, setupSessionId]);

  const startSetup = () => {
    setupMutation.mutate(undefined, {
      // Destino externo (Stripe): `router.push` no sirve, tiene que salir de
      // la app. `assign` deja la cuenta en el historial para el botón atrás.
      onSuccess: (url) => window.location.assign(url),
    });
  };

  const isBusy = setupMutation.isPending || confirmMutation.isPending;

  const addButton = (
    <Button type="button" onClick={startSetup} disabled={isBusy}>
      {isBusy ? <Loader2 className="animate-spin" /> : <Plus />}
      Agregar tarjeta
    </Button>
  );

  if (cardsQuery.isPending) {
    return <SavedCardsSkeleton />;
  }

  if (cardsQuery.isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          No se pudieron cargar tus tarjetas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {getApiErrorMessage(
            cardsQuery.error,
            "Inténtalo de nuevo en unos momentos.",
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => cardsQuery.refetch()}
          disabled={cardsQuery.isFetching}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  if (cardsQuery.data.length === 0) {
    return (
      <AccountEmptySection
        icon={<CreditCard />}
        title="Aún no tienes tarjetas guardadas"
        description="Guarda una tarjeta en Stripe y podrás pagar sin volver a teclear el número."
        action={addButton}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tus tarjetas se guardan en Stripe: aquí solo verás la marca y los
          cuatro últimos dígitos.
        </p>
        {addButton}
      </div>

      <div className="flex flex-col gap-3">
        {cardsQuery.data.map((card) => (
          <SavedCardItem
            key={card.id}
            card={card}
            onDelete={() => deleteMutation.mutateAsync(card.id)}
            isDeleting={
              deleteMutation.isPending && deleteMutation.variables === card.id
            }
          />
        ))}
      </div>
    </div>
  );
}
