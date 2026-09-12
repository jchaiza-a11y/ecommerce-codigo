import { Skeleton } from "@/components/ui/skeleton";

/** Reserva del espacio de una rejilla de tarjetas mientras el servidor resuelve. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-foreground/10"
        >
          <Skeleton className="aspect-4/3 w-full rounded-xl" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
