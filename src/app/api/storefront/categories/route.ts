import { NextResponse } from "next/server";

import { toStorefrontCategory } from "@/modules/storefront/lib/to-storefront-category";
import type { StorefrontCategory } from "@/modules/storefront/schemas/catalog.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

export async function GET() {
  try {
    const rows = await categoryRepository.findActiveWithProductCount();
    const body: StorefrontCategory[] = rows.map(toStorefrontCategory);

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/storefront/categories", error);

    return NextResponse.json(
      { error: "No se pudieron cargar las categorías" },
      { status: 500 },
    );
  }
}
