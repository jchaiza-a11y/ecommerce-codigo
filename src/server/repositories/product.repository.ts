import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/server/db";
import type { PgStatement } from "@/server/db/batch";
import { findPgError } from "@/server/db/pg-errors";
import { category } from "@/server/db/schema/category";
import { order } from "@/server/db/schema/order";
import { product } from "@/server/db/schema/product";
import type { NewProduct, Product } from "@/server/db/schema/product";

export type UpdateProductData = Partial<
  Omit<NewProduct, "id" | "createdAt" | "updatedAt" | "deletedAt">
>;

/** Fila de listado: el nombre de la categoría llega del join, sin N+1 por fila. */
export type ProductListItem = Product & { categoryName: string };

// Clasificación de errores de Postgres compartida por los repositorios. Se
// reexpone aquí para que el Route Handler siga hablando solo con el repositorio:
// `isUniqueViolation` cubre la carrera entre `findBySlug`/`findBySku` y el
// `insert`; `isForeignKeyViolation`, un `category_id` inexistente (§8.1).
export { isForeignKeyViolation, isUniqueViolation } from "@/server/db/pg-errors";

/**
 * Identifica cuál de los dos únicos chocó: slug y SKU tienen índices distintos
 * y el 409 debe señalar el campo culpable.
 */
export function getViolatedConstraint(error: unknown): string | undefined {
  return findPgError(error)?.constraint;
}

export const SLUG_CONSTRAINT = "products_slug_unique";
export const SKU_CONSTRAINT = "products_sku_unique";

export async function findAll(): Promise<ProductListItem[]> {
  const rows = await db
    .select({ product, categoryName: category.name })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .where(isNull(product.deletedAt))
    .orderBy(desc(product.createdAt));

  return rows.map((row) => ({ ...row.product, categoryName: row.categoryName }));
}

export type PublicProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "discount";

export type PublicProductFilters = {
  /** Lista: el catálogo permite marcar varias categorías a la vez (005 AC2). */
  categorySlugs?: string[];
  brands?: string[];
  priceMinCents?: number;
  priceMaxCents?: number;
  inStock?: boolean;
  q?: string;
  onSale?: boolean;
  sort?: PublicProductSort;
  page?: number;
  perPage?: number;
};

/**
 * Fila de catálogo público. Sigue siendo la fila completa de Drizzle: el
 * recorte a los campos publicables lo hace el mapper, único punto que
 * construye la respuesta (004 §10).
 */
export type PublicProductRow = Product & {
  categorySlug: string;
  categoryName: string;
};

/** Un producto retirado o desactivado no existe para la tienda (AC2). */
function publicWhere(filters: PublicProductFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    isNull(product.deletedAt),
    eq(product.isActive, true),
    eq(category.isActive, true),
  ];

  // Una lista vacía no es un filtro: `inArray` con `[]` dejaría el catálogo sin
  // resultados en vez de sin filtrar.
  if (filters.categorySlugs?.length) {
    conditions.push(inArray(category.slug, filters.categorySlugs));
  }

  if (filters.brands?.length) {
    conditions.push(inArray(product.brand, filters.brands));
  }

  if (filters.priceMinCents !== undefined) {
    conditions.push(gte(product.priceCents, filters.priceMinCents));
  }

  if (filters.priceMaxCents !== undefined) {
    conditions.push(lte(product.priceCents, filters.priceMaxCents));
  }

  if (filters.inStock) {
    conditions.push(gt(product.stock, 0));
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;

    conditions.push(
      or(ilike(product.name, pattern), ilike(product.brand, pattern)),
    );
  }

  if (filters.onSale) {
    conditions.push(
      and(
        isNotNull(product.compareAtPriceCents),
        gt(product.compareAtPriceCents, product.priceCents),
      ),
    );
  }

  return and(...conditions);
}

// `discount` ordena por descuento relativo, no absoluto: 20 € sobre 100 € pesa
// más que 20 € sobre 1.000 €. `nulls last` deja al final los que no tienen
// precio de comparación.
const DISCOUNT_RATIO = sql`
  case
    when ${product.compareAtPriceCents} > ${product.priceCents}
      then (${product.compareAtPriceCents} - ${product.priceCents})::numeric
           / ${product.compareAtPriceCents}
    else 0
  end
`;

function publicOrderBy(sort: PublicProductSort): SQL[] {
  switch (sort) {
    case "price_asc":
      return [asc(product.priceCents), asc(product.name)];
    case "price_desc":
      return [desc(product.priceCents), asc(product.name)];
    case "discount":
      return [desc(DISCOUNT_RATIO), desc(product.createdAt)];
    case "newest":
      return [desc(product.createdAt), asc(product.name)];
  }
}

export async function findPublic(
  filters: PublicProductFilters,
): Promise<PublicProductRow[]> {
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 12;

  const rows = await db
    .select({
      product,
      categorySlug: category.slug,
      categoryName: category.name,
    })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .where(publicWhere(filters))
    .orderBy(...publicOrderBy(filters.sort ?? "newest"))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return rows.map((row) => ({
    ...row.product,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
  }));
}

export async function countPublic(
  filters: PublicProductFilters,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .where(publicWhere(filters));

  return row?.total ?? 0;
}

/**
 * Faceta de marcas del catálogo público. Reusa `publicWhere` para que la lista
 * del aside no ofrezca marcas de productos retirados o desactivados (005 T2).
 */
export async function findPublicBrands(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ brand: product.brand })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .where(and(publicWhere({}), isNotNull(product.brand)))
    .orderBy(asc(product.brand));

  return rows
    .map((row) => row.brand)
    .filter((brand): brand is string => brand !== null);
}

/**
 * Ficha pública por slug (006 T1). Comparte `publicWhere` con el catálogo: la
 * definición de "producto visible" vive en un único sitio, así que un producto
 * desactivado o de categoría inactiva no tiene ficha (AC2). `findBySlug` no
 * sirve aquí: es la del admin y no filtra visibilidad.
 */
export async function findPublicBySlug(
  slug: string,
): Promise<PublicProductRow | undefined> {
  const [row] = await db
    .select({
      product,
      categorySlug: category.slug,
      categoryName: category.name,
    })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .where(and(publicWhere({}), eq(product.slug, slug)))
    .limit(1);

  if (!row) return undefined;

  return {
    ...row.product,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
  };
}

/**
 * Productos parecidos por heurística de catálogo, no por recomendador: sin
 * eventos ni tabla de relaciones, el único parecido disponible es la propia
 * ficha (006 §Notas). Recibe la fila ya cargada por la página para no repetir
 * la consulta del producto actual. Orden: misma marca primero, luego menor
 * distancia de precio, luego lo más reciente. Con `brand = null` no hay
 * criterio de marca y manda el precio.
 */
export async function findSimilar(
  row: PublicProductRow,
  limit = 4,
): Promise<PublicProductRow[]> {
  const orderBy: SQL[] = [];

  if (row.brand !== null) {
    orderBy.push(
      desc(sql`case when ${product.brand} = ${row.brand} then 1 else 0 end`),
    );
  }

  orderBy.push(
    asc(sql`abs(${product.priceCents} - ${row.priceCents})`),
    desc(product.createdAt),
  );

  const rows = await db
    .select({
      product,
      categorySlug: category.slug,
      categoryName: category.name,
    })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .where(
      and(
        publicWhere({}),
        eq(product.categoryId, row.categoryId),
        ne(product.id, row.id),
      ),
    )
    .orderBy(...orderBy)
    .limit(limit);

  return rows.map((similar) => ({
    ...similar.product,
    categorySlug: similar.categorySlug,
    categoryName: similar.categoryName,
  }));
}

export async function findById(id: string): Promise<Product | undefined> {
  const [found] = await db
    .select()
    .from(product)
    .where(and(eq(product.id, id), isNull(product.deletedAt)))
    .limit(1);

  return found;
}

export async function findBySlug(
  slug: string,
  excludeId?: string,
): Promise<Product | undefined> {
  const [found] = await db
    .select()
    .from(product)
    .where(
      and(
        eq(product.slug, slug),
        isNull(product.deletedAt),
        excludeId ? ne(product.id, excludeId) : undefined,
      ),
    )
    .limit(1);

  return found;
}

export async function findBySku(
  sku: string,
  excludeId?: string,
): Promise<Product | undefined> {
  const [found] = await db
    .select()
    .from(product)
    .where(
      and(
        eq(product.sku, sku),
        isNull(product.deletedAt),
        excludeId ? ne(product.id, excludeId) : undefined,
      ),
    )
    .limit(1);

  return found;
}

export async function create(data: NewProduct): Promise<Product> {
  const [created] = await db.insert(product).values(data).returning();

  return created;
}

export async function update(
  id: string,
  data: UpdateProductData,
): Promise<Product | undefined> {
  const [updated] = await db
    .update(product)
    .set(data)
    .where(and(eq(product.id, id), isNull(product.deletedAt)))
    .returning();

  return updated;
}

/**
 * Descuento de stock del fulfillment (008 T6), sin ejecutar: viaja en el mismo
 * `batch` que el paso del pedido a `paid`, y siempre **antes** de él.
 *
 * Dos guardas, no una:
 * - `exists (pedido en 'pending')` hace la sentencia idempotente. Con dos
 *   entregas simultáneas del mismo evento, la segunda espera el lock de la fila,
 *   reevalúa el `where` con el pedido ya en `paid` y no descuenta nada.
 * - `greatest(..., 0)` evita violar el check `products_stock_non_negative` si el
 *   stock cayó por debajo entre la creación de la sesión y el pago: una resta
 *   directa reventaría el batch en bucle con cada reintento de Stripe.
 */
export function buildStockDecrement(
  productId: string,
  quantity: number,
  orderId: string,
): PgStatement {
  return db
    .update(product)
    .set({ stock: sql`greatest(${product.stock} - ${quantity}, 0)` })
    .where(
      and(
        eq(product.id, productId),
        exists(
          db
            .select({ one: sql`1` })
            .from(order)
            .where(and(eq(order.id, orderId), eq(order.status, "pending"))),
        ),
      ),
    );
}

/**
 * Soft delete (§8.4): la fila sobrevive para las referencias futuras (líneas de
 * pedido, carritos) y solo se marca la fecha de retirada. Acotado a filas vivas,
 * así que un segundo borrado no afecta filas y el handler responde 404.
 */
export async function remove(id: string): Promise<Product | undefined> {
  const [removed] = await db
    .update(product)
    .set({ deletedAt: new Date() })
    .where(and(eq(product.id, id), isNull(product.deletedAt)))
    .returning();

  return removed;
}
