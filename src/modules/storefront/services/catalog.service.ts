import { api } from "@/lib/axios";
import type {
  PriceRangeId,
  StorefrontCategory,
  StorefrontProductPage,
  StorefrontSort,
} from "@/modules/storefront/schemas/catalog.schema";

const PRODUCTS_RESOURCE = "/api/storefront/products";
const CATEGORIES_RESOURCE = "/api/storefront/categories";

export type StorefrontProductParams = {
  category?: string | string[];
  brand?: string | string[];
  price?: PriceRangeId;
  inStock?: boolean;
  q?: string;
  sort?: StorefrontSort;
  onSale?: boolean;
  page?: number;
  perPage?: number;
};

/**
 * Un filtro vacío no viaja: el endpoint lo interpretaría como texto a buscar.
 * Las listas se serializan como CSV, que es el formato que espera el schema.
 */
function toQueryParams(
  params: StorefrontProductParams,
): Record<string, string> {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        query[key] = value.join(",");
      }

      continue;
    }

    query[key] = String(value);
  }

  return query;
}

export async function getStorefrontProducts(
  params: StorefrontProductParams = {},
): Promise<StorefrontProductPage> {
  const { data } = await api.get<StorefrontProductPage>(PRODUCTS_RESOURCE, {
    params: toQueryParams(params),
  });

  return data;
}

export async function getStorefrontCategories(): Promise<StorefrontCategory[]> {
  const { data } = await api.get<StorefrontCategory[]>(CATEGORIES_RESOURCE);

  return data;
}
