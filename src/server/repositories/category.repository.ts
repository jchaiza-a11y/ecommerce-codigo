import { and, asc, count, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/server/db";
import { category } from "@/server/db/schema/category";
import type { Category, NewCategory } from "@/server/db/schema/category";
import { product } from "@/server/db/schema/product";

export type UpdateCategoryData = Partial<
  Omit<NewCategory, "id" | "createdAt" | "updatedAt">
>;

// Clasificación de errores de Postgres compartida por los repositorios. Se
// reexpone aquí para que el Route Handler siga hablando solo con el repositorio.
// `isForeignKeyViolation` cubre el `ON DELETE RESTRICT` de `products.category_id`
// (002 §8.1): borrar una categoría con productos asociados debe dar 409, no 500.
export { isForeignKeyViolation, isUniqueViolation } from "@/server/db/pg-errors";

export async function findAll(): Promise<Category[]> {
  return db
    .select()
    .from(category)
    .orderBy(asc(category.sortOrder), asc(category.name));
}

export type CategoryWithProductCount = Category & { productCount: number };

/**
 * Taxonomía visible en la tienda. El conteo va agregado en el `left join`, no
 * en una consulta por categoría (004 §6): la fila sobrevive con 0 productos.
 */
export async function findActiveWithProductCount(): Promise<
  CategoryWithProductCount[]
> {
  const rows = await db
    .select({ category, productCount: count(product.id) })
    .from(category)
    .leftJoin(
      product,
      and(
        eq(product.categoryId, category.id),
        eq(product.isActive, true),
        isNull(product.deletedAt),
      ),
    )
    .where(eq(category.isActive, true))
    .groupBy(category.id)
    .orderBy(asc(category.sortOrder), asc(category.name));

  return rows.map((row) => ({
    ...row.category,
    productCount: row.productCount,
  }));
}

export async function findById(id: string): Promise<Category | undefined> {
  const [found] = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1);

  return found;
}

export async function findBySlug(
  slug: string,
  excludeId?: string,
): Promise<Category | undefined> {
  const [found] = await db
    .select()
    .from(category)
    .where(
      excludeId
        ? and(eq(category.slug, slug), ne(category.id, excludeId))
        : eq(category.slug, slug),
    )
    .limit(1);

  return found;
}

export async function create(data: NewCategory): Promise<Category> {
  const [created] = await db.insert(category).values(data).returning();

  return created;
}

export async function update(
  id: string,
  data: UpdateCategoryData,
): Promise<Category | undefined> {
  const [updated] = await db
    .update(category)
    .set(data)
    .where(eq(category.id, id))
    .returning();

  return updated;
}

export async function remove(id: string): Promise<Category | undefined> {
  const [removed] = await db
    .delete(category)
    .where(eq(category.id, id))
    .returning();

  return removed;
}
