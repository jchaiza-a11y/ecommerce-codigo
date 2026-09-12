"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { DataTable, type DataTableFilter } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { CATEGORY_STATUS_OPTIONS } from "@/modules/categories/constants";
import { buildCategoryColumns } from "@/modules/categories/components/category-columns";
import { CategoryFormDialog } from "@/modules/categories/components/category-form-dialog";
import { DeleteCategoryDialog } from "@/modules/categories/components/delete-category-dialog";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import { getApiErrorMessage } from "@/modules/categories/services/category.service";
import type { Category } from "@/modules/categories/types/category.types";

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_CATEGORIES: Category[] = [];

const STATUS_FILTERS: DataTableFilter[] = [
  {
    columnId: "isActive",
    label: "Estado",
    options: CATEGORY_STATUS_OPTIONS,
  },
];

export function CategoriesTable() {
  const { data, isPending, isError, error } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const columns = useMemo(
    () =>
      buildCategoryColumns({
        onEdit: (category) => {
          setEditing(category);
          setFormOpen(true);
        },
        onDelete: (category) => {
          setDeleting(category);
          setDeleteOpen(true);
        },
      }),
    [],
  );

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          No se pudieron cargar las categorías
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
          Nueva categoría
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data ?? EMPTY_CATEGORIES}
        isLoading={isPending}
        searchPlaceholder="Buscar por nombre o slug..."
        filters={STATUS_FILTERS}
        emptyMessage="Todavía no hay categorías. Crea la primera con “Nueva categoría”."
      />

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
      />

      <DeleteCategoryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        category={deleting}
      />
    </div>
  );
}
