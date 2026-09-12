import Link from "next/link";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { StorefrontCategory } from "@/modules/storefront/schemas/catalog.schema";

/**
 * Fila de categorías con desplazamiento horizontal. Cada chip abre el catálogo
 * con su categoría ya marcada (005 AC7).
 */
export function CategoryChips({
  categories,
}: {
  categories: StorefrontCategory[];
}) {
  if (categories.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aún no hay categorías publicadas.
      </p>
    );
  }

  return (
    <ScrollArea className="w-full">
      <ul className="flex w-max gap-3 pb-3">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/products?category=${encodeURIComponent(category.slug)}`}
              className="flex min-w-40 flex-col gap-1 rounded-2xl bg-card px-5 py-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-heading text-sm font-medium">
                {category.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {category.productCount}{" "}
                {category.productCount === 1 ? "producto" : "productos"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
