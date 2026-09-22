import { api } from "@/lib/axios";
import type {
  AdjustStockInput,
  InventoryItem,
  UpdateThresholdInput,
} from "@/modules/inventory/schemas/inventory.schema";

const RESOURCE = "/api/admin/inventory";

/**
 * Listado de inventario (013 T14). Sin query params: el filtro "solo stock
 * bajo" es client-side (§Decisiones 8).
 */
export async function getInventory(): Promise<InventoryItem[]> {
  const { data } = await api.get<InventoryItem[]>(RESOURCE);

  return data;
}

/**
 * Repone unidades. `quantity` es el incremento, no el stock final: la suma la
 * hace Postgres (§Decisiones 5). La respuesta trae la fila ya actualizada, así
 * que el hook puede pintarla sin esperar al refetch.
 */
export async function adjustStock(
  productId: string,
  input: AdjustStockInput,
): Promise<InventoryItem> {
  const { data } = await api.patch<InventoryItem>(
    `${RESOURCE}/${productId}/stock`,
    input,
  );

  return data;
}

export async function updateLowStockThreshold(
  productId: string,
  input: UpdateThresholdInput,
): Promise<InventoryItem> {
  const { data } = await api.patch<InventoryItem>(
    `${RESOURCE}/${productId}/threshold`,
    input,
  );

  return data;
}
