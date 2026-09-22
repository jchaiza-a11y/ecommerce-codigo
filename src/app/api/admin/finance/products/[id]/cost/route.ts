import { NextResponse } from "next/server";

import {
  AUDIT_ACTIONS,
  buildAuditLogInsert,
  getRequestAuditContext,
} from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { updateProductCostSchema } from "@/modules/finance/schemas/finance.schema";
import { productIdSchema } from "@/modules/products/schemas/product.schema";
import { runBatch } from "@/server/db/batch";
import * as productRepository from "@/server/repositories/product.repository";

const NOT_FOUND = "El producto no existe";

/**
 * Costo manual del producto (014 §API). Vive bajo `/api/admin/finance` y no en
 * el PATCH del catálogo porque es un dato de Finanzas: quien edita el producto
 * (`products.update`) no debería ver ni tocar márgenes, y quien costea
 * (`finance.manage`) no necesita editar el catálogo.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/finance/products/[id]/cost">,
) {
  const check = await requirePermission("finance.manage");

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

  const parsed = updateProductCostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { costCents } = parsed.data;

  try {
    // Un producto con soft delete es invisible para la API: se trata como 404.
    const existing = await productRepository.findById(parsedId.data);

    if (!existing) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    if (existing.costCents === costCents) {
      return NextResponse.json({ id: existing.id, costCents });
    }

    const { ipAddress, userAgent } = getRequestAuditContext(request);

    // `buildUpdate` en vez de `update` para meter la bitácora en el mismo
    // `batch` que la mutación (CLAUDE.md §4.9, AC6).
    await runBatch([
      productRepository.buildUpdate(parsedId.data, { costCents }),
      buildAuditLogInsert({
        actorId: check.user.id,
        action: AUDIT_ACTIONS.FINANCE_PRODUCT_COST_UPDATED,
        entityType: "product",
        entityId: existing.id,
        changes: {
          before: { costCents: existing.costCents },
          after: { costCents },
        },
        // Sin PII: solo el SKU para reconocer el producto en la bitácora.
        metadata: { source: "admin_panel", sku: existing.sku },
        ipAddress,
        userAgent,
      }),
    ]);

    return NextResponse.json({ id: existing.id, costCents });
  } catch (error) {
    console.error("PATCH /api/admin/finance/products/[id]/cost", error);

    return NextResponse.json(
      { error: "No se pudo actualizar el costo del producto" },
      { status: 500 },
    );
  }
}
