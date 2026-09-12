import type { StorefrontProductParams } from "@/modules/storefront/services/catalog.service";

export const catalogKeys = {
  all: ["storefront-catalog"] as const,
  products: () => [...catalogKeys.all, "products"] as const,
  productSearch: (term: string) =>
    [...catalogKeys.products(), "search", term] as const,
  /** Cada combinación de filtros es su propia entrada de caché (005 T6). */
  list: (filters: StorefrontProductParams) =>
    [...catalogKeys.products(), "list", filters] as const,
  categories: () => [...catalogKeys.all, "categories"] as const,
};

/** AC5: una sola petición por pausa de escritura. */
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_RESULT_LIMIT = 6;

export const DEALS_LIMIT = 8;
export const FEATURED_LIMIT = 8;

/** Tamaño de página del grid de `/products` y de su botón "Ver más". */
export const CATALOG_PER_PAGE = 12;

/** Parecidos de la ficha: lo comparten la consulta y el skeleton del segmento. */
export const SIMILAR_PRODUCTS_LIMIT = 4;

/** Imagen propia para `image_url` nulo: `next/image` no acepta `src` vacío (§8.5). */
export const PRODUCT_IMAGE_FALLBACK = "/product-placeholder.svg";
