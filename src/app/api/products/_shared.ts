import { NextResponse } from "next/server";

import * as productRepository from "@/server/repositories/product.repository";

export const SLUG_TAKEN = "Ya existe un producto con ese slug";
export const SKU_TAKEN = "Ya existe un producto con ese SKU";
export const CATEGORY_NOT_FOUND = "La categoría seleccionada no existe";

/** El 409 debe señalar cuál de los dos únicos chocó (§10). */
export function conflictFromUniqueViolation(
  error: unknown,
): NextResponse | null {
  if (!productRepository.isUniqueViolation(error)) {
    return null;
  }

  const constraint = productRepository.getViolatedConstraint(error);

  return NextResponse.json(
    {
      error:
        constraint === productRepository.SKU_CONSTRAINT ? SKU_TAKEN : SLUG_TAKEN,
    },
    { status: 409 },
  );
}
