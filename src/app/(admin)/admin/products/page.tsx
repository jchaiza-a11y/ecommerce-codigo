import type { Metadata } from "next";

import { ProductsTable } from "@/modules/products/components/products-table";

export const metadata: Metadata = {
  title: "Productos",
  description: "Administra el catálogo de productos de la tienda.",
};

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Crea, edita y retira los productos del catálogo, con su precio, stock y
          categoría.
        </p>
      </header>

      <ProductsTable />
    </div>
  );
}
