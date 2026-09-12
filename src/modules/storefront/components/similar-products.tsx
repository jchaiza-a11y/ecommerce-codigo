import { ProductCard } from "@/modules/storefront/components/product-card";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

/**
 * Tira de parecidos al pie de la ficha. Sin resultados no pinta nada — ni
 * bloque vacío ni "sin resultados" (AC10): una sección secundaria no debe
 * ocupar espacio para decir que no tiene contenido.
 */
export function SimilarProducts({
  products,
}: {
  products: StorefrontProduct[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Productos parecidos
        </h2>
        <p className="text-sm text-muted-foreground">
          Otras opciones de la misma categoría.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
