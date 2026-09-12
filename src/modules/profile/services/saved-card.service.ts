import { api } from "@/lib/axios";
import type {
  CardSetupSessionResponse,
  SavedCard,
  SavedCardResponse,
  SavedCardsResponse,
} from "@/modules/profile/schemas/saved-card.schema";

const RESOURCE = "/api/profile/payment-methods";

export async function getSavedCards(): Promise<SavedCard[]> {
  const { data } = await api.get<SavedCardsResponse>(RESOURCE);

  return data.items;
}

/** Devuelve la url hospedada de Stripe a la que redirigir (AC2). */
export async function createCardSetupSession(): Promise<string> {
  const { data } = await api.post<CardSetupSessionResponse>(
    `${RESOURCE}/setup-session`,
    {},
  );

  return data.url;
}

export async function confirmSavedCard(
  setupSessionId: string,
): Promise<SavedCard> {
  const { data } = await api.post<SavedCardResponse>(RESOURCE, {
    setupSessionId,
  });

  return data.item;
}

export async function deleteSavedCard(id: string): Promise<void> {
  await api.delete(`${RESOURCE}/${id}`);
}
