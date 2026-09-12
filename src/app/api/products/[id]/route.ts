import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import {
  productIdSchema,
  updateProductSchema,
} from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

import {
  CATEGORY_NOT_FOUND,
  conflictFromUniqueViolation,
  SKU_TAKEN,
  SLUG_TAKEN,
} from "../_shared";

const NOT_FOUND = "El producto no existe";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  const check = await requirePermission("products.update");

  if (!check.ok) {
    return check.response;
  }

  const { id } = await context.params;
  const parsedId = productIdSchema.safeParse(id);

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

  const parsed = updateProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { description, brand, imageUrl, compareAtPriceCents, ...rest } =
    parsed.data;

  try {
    // Un producto con soft delete es invisible para la API: se trata como 404.
    const existing = await productRepository.findById(parsedId.data);

    if (!existing) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    if (rest.slug) {
      const duplicate = await productRepository.findBySlug(
        rest.slug,
        parsedId.data,
      );

      if (duplicate) {
        return NextResponse.json({ error: SLUG_TAKEN }, { status: 409 });
      }
    }

    if (rest.sku) {
      const duplicate = await productRepository.findBySku(
        rest.sku,
        parsedId.data,
      );

      if (duplicate) {
        return NextResponse.json({ error: SKU_TAKEN }, { status: 409 });
      }
    }

    const updated = await productRepository.update(parsedId.data, {
      ...rest,
      ...(description !== undefined ? { description: description ?? null } : {}),
      ...(brand !== undefined ? { brand: brand ?? null } : {}),
      ...(imageUrl !== undefined ? { imageUrl: imageUrl ?? null } : {}),
      ...(compareAtPriceCents !== undefined
        ? { compareAtPriceCents: compareAtPriceCents ?? null }
        : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    const conflict = conflictFromUniqueViolation(error);

    if (conflict) {
      return conflict;
    }

    if (productRepository.isForeignKeyViolation(error)) {
      return NextResponse.json({ error: CATEGORY_NOT_FOUND }, { status: 400 });
    }

    console.error("PATCH /api/products/[id]", error);

    return NextResponse.json(
      { error: "No se pudo actualizar el producto" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  const check = await requirePermission("products.delete");

  if (!check.ok) {
    return check.response;
  }

  const { id } = await context.params;
  const parsedId = productIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: parsedId.error.issues },
      { status: 400 },
    );
  }

  try {
    // Soft delete (§8.4): marca `deleted_at`, no borra la fila. Si no afecta
    // ninguna (inexistente o ya eliminado) el producto no existe para la API.
    const removed = await productRepository.remove(parsedId.data);

    if (!removed) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/products/[id]", error);

    return NextResponse.json(
      { error: "No se pudo eliminar el producto" },
      { status: 500 },
    );
  }
}
