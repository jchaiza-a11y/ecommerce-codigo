import type { Metadata } from "next";

import { CategoriesTable } from "@/modules/categories/components/categories-table";

export const metadata: Metadata = {
  title: "Categorías",
  description: "Administra la taxonomía de productos del catálogo.",
};

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Crea, edita y organiza las categorías con las que se clasifican los
          productos del catálogo.
        </p>
      </header>

      <CategoriesTable />
    </div>
  );
}
