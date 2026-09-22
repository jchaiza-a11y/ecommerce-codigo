import { NextResponse } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { updateThresholdSchema } from "@/modules/inventory/schemas/inventory.schema";
import { runBatch } from "@/server/db/batch";
import * as productRepository from "@/server/repositories/product.repository";

import {
  invalidPayload,
  PRODUCT_NOT_FOUND,
  readMutationRequest,
} from "../../_shared";

/**
 * Ajuste del umbral de alerta (013 T13). Mismo patrón que la reposición pero
 * endpoint aparte: cada acción tiene su Zod, su acción de auditoría y su
 * `changes`, y un handler que mezclara ambos campos tendría que adivinar qué
 * log escribir (§Decisiones 3).
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/inventory/[productId]/threshold">,
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

  const parsed = updateThresholdSchema.safeParse(parsedRequest.body);

  if (!parsed.success) {
    return invalidPayload(parsed.error.issues);
  }

  const { threshold } = parsed.data;

  try {
    const before = await productRepository.findInventoryById(
      parsedRequest.productId,
    );

    if (!before) {
      return NextResponse.json({ error: PRODUCT_NOT_FOUND }, { status: 404 });
    }

    const { ipAddress, userAgent } = getRequestAuditContext(request);

    await runBatch([
      productRepository.buildLowStockThresholdUpdate(
        parsedRequest.productId,
        threshold,
      ),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.PRODUCT_LOW_STOCK_THRESHOLD_UPDATED,
        entityType: "product",
        entityId: before.id,
        changes: {
          before: { lowStockThreshold: before.lowStockThreshold },
          after: { lowStockThreshold: threshold },
        },
        metadata: { source: "admin_panel" },
        ipAddress,
        userAgent,
      }),
    ]);

    const updated = await productRepository.findInventoryById(
      parsedRequest.productId,
    );

    if (!updated) {
      return NextResponse.json({ error: PRODUCT_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/inventory/[productId]/threshold", error);

    return NextResponse.json(
      { error: "No se pudo actualizar el umbral" },
      { status: 500 },
    );
  }
}
