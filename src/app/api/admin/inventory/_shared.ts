import { NextResponse } from "next/server";
import type { z } from "zod";

import { productIdSchema } from "@/modules/products/schemas/product.schema";

export const PRODUCT_NOT_FOUND = "El producto no existe";

/**
 * Prólogo común de los dos `PATCH` de inventario: identificador válido y
 * cuerpo JSON parseable. Lo que NO se comparte es la validación del cuerpo —
 * cada endpoint tiene su propio schema, su acción de auditoría y su `changes`
 * (013 §Decisiones 3)—, así que esto devuelve el `body` sin tipar.
 */
export type MutationRequest =
  | { ok: false; response: NextResponse }
  | { ok: true; productId: string; body: unknown };

export async function readMutationRequest(
  request: Request,
  rawProductId: string,
): Promise<MutationRequest> {
  const parsedId = productIdSchema.safeParse(rawProductId);

  if (!parsedId.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Identificador inválido", issues: parsedId.error.issues },
        { status: 400 },
      ),
    };
  }

  try {
    return { ok: true, productId: parsedId.data, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "El cuerpo de la petición no es JSON válido" },
        { status: 400 },
      ),
    };
  }
}

/** 400 con los `issues` de Zod, que es lo que pinta el formulario (AC5, AC6). */
export function invalidPayload(
  issues: readonly z.core.$ZodIssue[],
): NextResponse {
  return NextResponse.json({ error: "Datos inválidos", issues }, { status: 400 });
}
