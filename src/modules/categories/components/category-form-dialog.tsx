"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/modules/categories/hooks/use-category-mutations";
import {
  createCategorySchema,
  type CreateCategoryInput,
  type CreateCategoryValues,
  type UpdateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import {
  getApiErrorMessage,
  isConflictError,
} from "@/modules/categories/services/category.service";
import type { Category } from "@/modules/categories/types/category.types";

const SLUG_TAKEN = "Ya existe una categoría con ese slug";

const EMPTY_VALUES: CreateCategoryInput = {
  name: "",
  slug: "",
  description: "",
  isActive: true,
  sortOrder: 0,
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toFormValues(category: Category): CreateCategoryInput {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}

function normalizeDescription(value: string | null | undefined): string | null {
  return value?.trim() ? value : null;
}

/** Solo los campos que el usuario cambió respecto de la fila original. */
function diffValues(
  values: CreateCategoryValues,
  category: Category,
): UpdateCategoryInput {
  const changes: UpdateCategoryInput = {};
  const description = normalizeDescription(values.description);

  if (values.name !== category.name) changes.name = values.name;
  if (values.slug !== category.slug) changes.slug = values.slug;
  if (description !== category.description) changes.description = description;
  if (values.isActive !== category.isActive) changes.isActive = values.isActive;
  if (values.sortOrder !== category.sortOrder) {
    changes.sortOrder = values.sortOrder;
  }

  return changes;
}

type CategoryFormProps = {
  category: Category | null;
  onClose: () => void;
};

function CategoryForm({ category, onClose }: CategoryFormProps) {
  const isEditing = category !== null;
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  // En alta el slug sigue al nombre hasta que el usuario lo edita a mano.
  const [slugTouched, setSlugTouched] = useState(isEditing);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<CreateCategoryInput, unknown, CreateCategoryValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: category ? toFormValues(category) : EMPTY_VALUES,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (category) {
        const changes = diffValues(values, category);

        if (Object.keys(changes).length > 0) {
          await updateMutation.mutateAsync({ id: category.id, input: changes });
        }
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: normalizeDescription(values.description),
        });
      }

      onClose();
    } catch (error) {
      // El diálogo permanece abierto: el hook ya notificó por toast y el 409
      // se marca además sobre el campo que lo provoca.
      if (isConflictError(error)) {
        setError("slug", {
          message: getApiErrorMessage(error, SLUG_TAKEN),
        });
      }
    }
  });

  const nameField = register("name");

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="category-name">Nombre</FieldLabel>
          <Input
            id="category-name"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...nameField}
            onChange={(event) => {
              nameField.onChange(event);

              if (!slugTouched) {
                setValue("slug", slugify(event.target.value), {
                  shouldValidate: Boolean(errors.slug),
                });
              }
            }}
          />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.slug)}>
          <FieldLabel htmlFor="category-slug">Slug</FieldLabel>
          <Input
            id="category-slug"
            autoComplete="off"
            aria-invalid={Boolean(errors.slug)}
            {...register("slug", { onChange: () => setSlugTouched(true) })}
          />
          <FieldDescription>
            Identificador para la URL pública. Solo minúsculas, números y
            guiones.
          </FieldDescription>
          <FieldError errors={errors.slug ? [errors.slug] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="category-description">Descripción</FieldLabel>
          <Textarea
            id="category-description"
            rows={3}
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          <FieldError
            errors={errors.description ? [errors.description] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.sortOrder)}>
          <FieldLabel htmlFor="category-sort-order">Orden</FieldLabel>
          <Controller
            control={control}
            name="sortOrder"
            render={({ field }) => (
              <Input
                id="category-sort-order"
                type="number"
                min={0}
                step={1}
                aria-invalid={Boolean(errors.sortOrder)}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? 0}
                onChange={(event) => {
                  const next = event.target.valueAsNumber;
                  field.onChange(Number.isNaN(next) ? 0 : next);
                }}
              />
            )}
          />
          <FieldError
            errors={errors.sortOrder ? [errors.sortOrder] : undefined}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="category-is-active">Categoría activa</FieldLabel>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="category-is-active"
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </Field>
      </FieldGroup>

      <DialogFooter className="mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isEditing ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type CategoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: CategoryFormDialogProps) {
  const isEditing = category !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos de la categoría y guarda los cambios."
              : "Crea una categoría para clasificar los productos del catálogo."}
          </DialogDescription>
        </DialogHeader>

        {/* El contenido se desmonta al cerrar, así que el formulario se
            reinicializa solo; `key` lo fuerza también al cambiar de fila. */}
        <CategoryForm
          key={category?.id ?? "new"}
          category={category}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
