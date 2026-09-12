import { NextResponse, type NextRequest } from "next/server";

import { toStorefrontProduct } from "@/modules/storefront/lib/to-storefront-product";
import type { StorefrontProductPage } from "@/modules/storefront/schemas/catalog.schema";
import {
  PRICE_RANGES,
  storefrontProductQuerySchema,
} from "@/modules/storefront/schemas/catalog.schema";
import type { PublicProductFilters } from "@/server/repositories/product.repository";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET(request: NextRequest) {
  const parsed = storefrontProductQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros de búsqueda inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { category, brand, price, inStock, q, onSale, sort, page, perPage } =
    parsed.data;

  // El enum de rango se traduce a centavos aquí: el repositorio solo entiende
  // de mínimos y máximos, no del vocabulario de la UI.
  const range = PRICE_RANGES.find((item) => item.id === price);

  const filters: PublicProductFilters = {
    categorySlugs: category,
    brands: brand,
    priceMinCents: range?.minCents ?? undefined,
    priceMaxCents: range?.maxCents ?? undefined,
    inStock,
    q,
    onSale,
    sort,
    page,
    perPage,
  };

  try {
    // El conteo comparte el mismo filtro que el listado, así que `total` y
    // `totalPages` siempre cuadran con lo que se está viendo (AC3).
    const [rows, total] = await Promise.all([
      productRepository.findPublic(filters),
      productRepository.countPublic(filters),
    ]);

    const body: StorefrontProductPage = {
      items: rows.map(toStorefrontProduct),
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/storefront/products", error);

    return NextResponse.json(
      { error: "No se pudo cargar el catálogo" },
      { status: 500 },
    );
  }
}
