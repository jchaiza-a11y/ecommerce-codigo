import { z } from "zod";

export const STOREFRONT_SORTS = [
  "newest",
  "price_asc",
  "price_desc",
  "discount",
] as const;

export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export const DEFAULT_PER_PAGE = 12;
export const MAX_PER_PAGE = 48;

/**
 * Rangos de precio del aside, en centavos (§5: nunca `float`). Los tramos son
 * contiguos y sin solape: el límite superior de uno es un centavo menos que el
 * inferior del siguiente. `null` = tramo abierto por ese lado.
 */
export const PRICE_RANGES = [
  { id: "lt500", label: "Menos de 500 €", minCents: null, maxCents: 49_999 },
  {
    id: "500-1500",
    label: "500 € – 1.500 €",
    minCents: 50_000,
    maxCents: 150_000,
  },
  {
    id: "1500-4000",
    label: "1.500 € – 4.000 €",
    minCents: 150_001,
    maxCents: 400_000,
  },
  { id: "gt4000", label: "Más de 4.000 €", minCents: 400_001, maxCents: null },
] as const satisfies readonly {
  id: string;
  label: string;
  minCents: number | null;
  maxCents: number | null;
}[];

export type PriceRangeId = (typeof PRICE_RANGES)[number]["id"];

export const PRICE_RANGE_IDS = PRICE_RANGES.map((range) => range.id);

/**
 * `category` y `brand` viajan como CSV (005 §API). Un solo valor sigue siendo
 * válido y `undefined` cuando la lista queda vacía tras limpiar los huecos.
 */
function csvParam(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .optional()
    .transform((value) => {
      if (!value) return undefined;

      const items = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      return items.length > 0 ? items : undefined;
    });
}

/**
 * Query del catálogo público. Todo llega como texto desde `searchParams`, así
 * que `page`/`perPage` se coercionan y se acotan: un `perPage` sin techo deja
 * que un anónimo pida el catálogo entero en una sola llamada (AC4).
 */
export const storefrontProductQuerySchema = z.object({
  category: csvParam(400),
  brand: csvParam(400),
  price: z.enum(PRICE_RANGE_IDS).optional(),
  inStock: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  q: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(STOREFRONT_SORTS).default("newest"),
  onSale: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});

export type StorefrontProductQueryInput = z.input<
  typeof storefrontProductQuerySchema
>;
export type StorefrontProductQuery = z.infer<
  typeof storefrontProductQuerySchema
>;

/**
 * Contrato de salida del catálogo. Es deliberadamente más estrecho que la fila
 * de `products`: `sku`, `stock`, `isActive` y `deletedAt` no se publican (AC2).
 */
export const storefrontProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  brand: z.string().nullable(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  compareAtPriceCents: z.number().int().nullable(),
  discountPercent: z.number().int().nullable(),
  imageUrl: z.string().nullable(),
  categorySlug: z.string(),
  categoryName: z.string(),
  inStock: z.boolean(),
  isNew: z.boolean(),
});

export type StorefrontProduct = z.infer<typeof storefrontProductSchema>;

export const storefrontProductPageSchema = z.object({
  items: z.array(storefrontProductSchema),
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type StorefrontProductPage = z.infer<typeof storefrontProductPageSchema>;

export const storefrontCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  productCount: z.number().int(),
});

export type StorefrontCategory = z.infer<typeof storefrontCategorySchema>;

/** Email del formulario de newsletter (§8.6): se valida, no se persiste. */
export const newsletterEmailSchema = z.object({
  email: z.email("Introduce un correo válido"),
});

export type NewsletterEmailInput = z.infer<typeof newsletterEmailSchema>;
