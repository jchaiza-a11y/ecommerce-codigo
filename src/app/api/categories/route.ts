import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { createCategorySchema } from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

const SLUG_TAKEN = "Ya existe una categoría con ese slug";

export async function GET() {
  try {
    const categories = await categoryRepository.findAll();

    return NextResponse.json(categories);
  } catch (error) {
    console.error("GET /api/categories", error);

    return NextResponse.json(
      { error: "No se pudieron cargar las categorías" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  // El `GET` sigue público para el storefront; la mutación se cierra aquí
  // porque el matcher del middleware no distingue el verbo (003 §8.8).
  const check = await requirePermission("categories.create");

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

  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, slug, description, isActive, sortOrder } = parsed.data;

  try {
    const existing = await categoryRepository.findBySlug(slug);

    if (existing) {
      return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 });
    }

    const created = await categoryRepository.create({
      name,
      slug,
      description: description ?? null,
      isActive,
      sortOrder,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (categoryRepository.isUniqueViolation(error)) {
      return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 });
    }

    console.error("POST /api/categories", error);

    return NextResponse.json(
      { error: "No se pudo crear la categoría" },
      { status: 500 },
    );
  }
}
