import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/modules/storefront/components/product-card";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

export function FeaturedGrid({ products }: { products: StorefrontProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aún no hay productos en el catálogo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="flex justify-center">
        <Button asChild variant="outline" size="lg" className="rounded-full px-8">
          <Link href="/products">
            Ver todo el catálogo
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
