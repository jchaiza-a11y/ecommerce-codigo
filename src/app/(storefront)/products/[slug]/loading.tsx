import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/modules/storefront/components/product-grid-skeleton";
import { SIMILAR_PRODUCTS_LIMIT } from "@/modules/storefront/constants";

/** Reserva el hueco de la ficha y el de la tira de parecidos, en ese orden. */
export default function ProductDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6 md:gap-24 md:py-12">
      <div className="flex flex-col gap-8">
        <Skeleton className="h-4 w-48" />

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <Skeleton className="aspect-4/3 w-full rounded-3xl" />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-4/5" />
            </div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-11 w-full rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-72" />
        <ProductGridSkeleton count={SIMILAR_PRODUCTS_LIMIT} />
      </div>
    </div>
  );
}
