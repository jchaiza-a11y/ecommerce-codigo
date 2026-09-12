import Link from "next/link";
import { PackageX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 404 del segmento: cubre tanto el slug inexistente como el producto retirado,
 * desactivado o de categoría inactiva (AC2). Deliberadamente distinto del
 * bloque de error de BD de `page.tsx` (AC8).
 */
export default function ProductNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
      <PackageX className="size-10 text-muted-foreground" />

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Este producto ya no está disponible
        </h1>
        <p className="text-sm text-muted-foreground">
          Puede que se haya retirado del catálogo o que el enlace esté mal.
        </p>
      </div>

      <Button asChild size="lg" className="rounded-full px-8">
        <Link href="/products">Ver el catálogo</Link>
      </Button>
    </div>
  );
}
