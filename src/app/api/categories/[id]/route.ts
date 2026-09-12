import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import {
  categoryIdSchema,
  updateCategorySchema,
} from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

const SLUG_TAKEN = "Ya existe una categoría con ese slug";
const NOT_FOUND = "La categoría no existe";
// El mensaje no promete que baste con vaciar la tabla visible: un producto
// retirado del catálogo conserva su FK y sigue bloqueando el borrado (002 §10).
const HAS_PRODUCTS =
  "No se puede eliminar: hay productos asociados a esta categoría, incluidos los que ya no aparecen en el catálogo. Reasígnalos a otra categoría antes de eliminarla.";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/categories/[id]">,
) {
  const check = await requirePermission("categories.update");

  if (!check.ok) {
    return check.response;
  }

  const { id } = await context.params;
  const parsedId = categoryIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: parsedId.error.issues },
      { status: 400 },
    );
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

  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { description, ...rest } = parsed.data;

  try {
    const existing = await categoryRepository.findById(parsedId.data);

    if (!existing) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    if (rest.slug) {
      const duplicate = await categoryRepository.findBySlug(
        rest.slug,
        parsedId.data,
      );

      if (duplicate) {
        return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 });
      }
    }

    const updated = await categoryRepository.update(parsedId.data, {
      ...rest,
      ...(description !== undefined ? { description: description ?? null } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (categoryRepository.isUniqueViolation(error)) {
      return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 });
    }

    console.error("PATCH /api/categories/[id]", error);

    return NextResponse.json(
      { error: "No se pudo actualizar la categoría" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/categories/[id]">,
) {
  const check = await requirePermission("categories.delete");

  if (!check.ok) {
    return check.response;
  }

  const { id } = await context.params;
  const parsedId = categoryIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: parsedId.error.issues },
      { status: 400 },
    );
  }

  try {
    const removed = await categoryRepository.remove(parsedId.data);

    if (!removed) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (categoryRepository.isForeignKeyViolation(error)) {
      return NextResponse.json({ error: HAS_PRODUCTS }, { status: 409 });
    }

    console.error("DELETE /api/categories/[id]", error);

    return NextResponse.json(
      { error: "No se pudo eliminar la categoría" },
      { status: 500 },
    );
  }
}
