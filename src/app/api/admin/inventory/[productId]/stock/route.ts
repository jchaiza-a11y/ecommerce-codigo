import { NextResponse } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { adjustStockSchema } from "@/modules/inventory/schemas/inventory.schema";
import { runBatch } from "@/server/db/batch";
import * as productRepository from "@/server/repositories/product.repository";

import {
  invalidPayload,
  PRODUCT_NOT_FOUND,
  readMutationRequest,
} from "../../_shared";

/**
 * Reposición de stock (013 T12). **Suma** unidades, nunca reemplaza el total:
 * corregir a la baja sigue siendo cosa del formulario de producto (§Alcance).
 *
 * `products.view` deja ver la tabla; mover stock exige `products.update`
 * (AC11).
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/inventory/[productId]/stock">,
) {
  const check = await requirePermission("products.update");

  if (!check.ok) {
    return check.response;
  }

  const { productId } = await context.params;
  const parsedRequest = await readMutationRequest(request, productId);

  if (!parsedRequest.ok) {
    return parsedRequest.response;
  }

  const parsed = adjustStockSchema.safeParse(parsedRequest.body);

  if (!parsed.success) {
    return invalidPayload(parsed.error.issues);
  }

  const { quantity } = parsed.data;

  try {
    // Lectura previa al batch (§Decisiones 5): `neon-http` no permite leer
    // dentro de la transacción y el `before` de la bitácora lo necesita. Un
    // producto con soft delete no existe para la API.
    const before = await productRepository.findInventoryById(
      parsedRequest.productId,
    );

    if (!before) {
      return NextResponse.json({ error: PRODUCT_NOT_FOUND }, { status: 404 });
    }

    const { ipAddress, userAgent } = getRequestAuditContext(request);

    // Mutación y log en el mismo `db.batch()`: o entran las dos o no entra
    // ninguna (AC9). El `after` se narra sumando sobre el `before` leído; el
    // stock real lo calcula Postgres, así que ante dos reposiciones a la vez el
    // total es correcto aunque el log de una de ellas quede desfasado (§Notas).
    await runBatch([
      productRepository.buildStockIncrement(parsedRequest.productId, quantity),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.PRODUCT_STOCK_ADJUSTED,
        entityType: "product",
        entityId: before.id,
        changes: {
          before: { stock: before.stock },
          after: { stock: before.stock + quantity },
        },
        metadata: { source: "admin_panel", delta: quantity },
        ipAddress,
        userAgent,
      }),
    ]);

    // `db.batch()` no devuelve filas (§Decisiones 6). Si el producto recibió un
    // soft delete en la carrera, el `UPDATE` no afectó a nadie y aquí se ve.
    const updated = await productRepository.findInventoryById(
      parsedRequest.productId,
    );

    if (!updated) {
      return NextResponse.json({ error: PRODUCT_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/inventory/[productId]/stock", error);

    return NextResponse.json(
      { error: "No se pudo reponer el stock" },
      { status: 500 },
    );
  }
}
