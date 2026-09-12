"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { DataTable, type DataTableFilter } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import { buildProductColumns } from "@/modules/products/components/product-columns";
import { DeleteProductDialog } from "@/modules/products/components/delete-product-dialog";
import { ProductFormDialog } from "@/modules/products/components/product-form-dialog";
import { PRODUCT_STATUS_OPTIONS } from "@/modules/products/constants";
import { useProducts } from "@/modules/products/hooks/use-products";
import { getApiErrorMessage } from "@/modules/products/services/product.service";
import type { ProductListItem } from "@/modules/products/types/product.types";

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_PRODUCTS: ProductListItem[] = [];

export function ProductsTable() {
  const { data, isPending, isError, error } = useProducts();
  const categoriesQuery = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductListItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProductListItem | null>(null);

  const columns = useMemo(
    () =>
      buildProductColumns({
        onEdit: (product) => {
          setEditing(product);
          setFormOpen(true);
        },
        onDelete: (product) => {
          setDeleting(product);
          setDeleteOpen(true);
        },
      }),
    [],
  );

  const categories = categoriesQuery.data;

  // El filtro compara contra `categoryName`, así que las opciones son nombres.
  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        columnId: "isActive",
        label: "Estado",
        options: PRODUCT_STATUS_OPTIONS,
      },
      {
        columnId: "categoryName",
        label: "Categoría",
        options: (categories ?? []).map((category) => ({
          label: category.name,
          value: category.name,
        })),
      },
    ],
    [categories],
  );

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          No se pudieron cargar los productos
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {getApiErrorMessage(error, "Inténtalo de nuevo en unos momentos.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nuevo producto
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data ?? EMPTY_PRODUCTS}
        isLoading={isPending}
        searchPlaceholder="Buscar por nombre, SKU o categoría..."
        filters={filters}
        emptyMessage="Todavía no hay productos. Crea el primero con “Nuevo producto”."
      />

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
      />

      <DeleteProductDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        product={deleting}
      />
    </div>
  );
}
