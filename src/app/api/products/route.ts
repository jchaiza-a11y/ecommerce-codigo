import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { createProductSchema } from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

import {
  CATEGORY_NOT_FOUND,
  conflictFromUniqueViolation,
  SKU_TAKEN,
  SLUG_TAKEN,
} from "./_shared";

export async function GET() {
  try {
    const products = await productRepository.findAll();

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/products", error);

    return NextResponse.json(
      { error: "No se pudieron cargar los productos" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  // El `GET` sigue público para el storefront; la mutación se cierra aquí
  // porque el matcher del middleware no distingue el verbo (003 §8.8).
  const check = await requirePermission("products.create");

  if (!check.ok) {
    return check.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la petición no es JSON válido" },
      { status: 400 },
    );
  }

  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const {
    name,
    slug,
    sku,
    description,
    brand,
    priceCents,
    compareAtPriceCents,
    stock,
    categoryId,
    imageUrl,
    isActive,
  } = parsed.data;

  try {
    // Verificación solo contra filas vivas: un producto eliminado libera su
    // slug y su SKU, igual que los índices únicos parciales (§8.4).
    const [duplicateSlug, duplicateSku] = await Promise.all([
      productRepository.findBySlug(slug),
      productRepository.findBySku(sku),
    ]);

    if (duplicateSlug) {
      return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 });
    }

    if (duplicateSku) {
      return NextResponse.json({ error: SKU_TAKEN }, { status: 409 });
    }

    const created = await productRepository.create({
      name,
      slug,
      sku,
      description: description ?? null,
      brand: brand ?? null,
      priceCents,
      compareAtPriceCents: compareAtPriceCents ?? null,
      stock,
      categoryId,
      imageUrl: imageUrl ?? null,
      isActive,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const conflict = conflictFromUniqueViolation(error);

    if (conflict) {
      return conflict;
    }

    if (productRepository.isForeignKeyViolation(error)) {
      return NextResponse.json({ error: CATEGORY_NOT_FOUND }, { status: 400 });
    }

    console.error("POST /api/products", error);

    return NextResponse.json(
      { error: "No se pudo crear el producto" },
      { status: 500 },
    );
  }
}
