"use client";

import { useState } from "react";
import { Controller, useForm, type DefaultValues } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import { centsToUnits, unitsToCents } from "@/modules/products/constants";
import {
  useCreateProduct,
  useUpdateProduct,
} from "@/modules/products/hooks/use-product-mutations";
import {
  createProductSchema,
  type CreateProductInput,
  type CreateProductValues,
  type UpdateProductInput,
} from "@/modules/products/schemas/product.schema";
import {
  getApiErrorMessage,
  isConflictError,
} from "@/modules/products/services/product.service";
import type { ProductListItem } from "@/modules/products/types/product.types";

const SLUG_TAKEN = "Ya existe un producto con ese slug";

const EMPTY_VALUES: DefaultValues<CreateProductInput> = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  brand: "",
  compareAtPriceCents: null,
  stock: 0,
  categoryId: "",
  imageUrl: "",
  isActive: true,
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toFormValues(
  product: ProductListItem,
): DefaultValues<CreateProductInput> {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description ?? "",
    brand: product.brand ?? "",
    priceCents: product.priceCents,
    compareAtPriceCents: product.compareAtPriceCents,
    stock: product.stock,
    categoryId: product.categoryId,
    imageUrl: product.imageUrl ?? "",
    isActive: product.isActive,
  };
}

function normalizeText(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

/** Solo los campos que el usuario cambió respecto de la fila original. */
function diffValues(
  values: CreateProductValues,
  product: ProductListItem,
): UpdateProductInput {
  const changes: UpdateProductInput = {};
  const description = normalizeText(values.description);
  const brand = normalizeText(values.brand);
  const imageUrl = normalizeText(values.imageUrl);
  const compareAtPriceCents = values.compareAtPriceCents ?? null;

  if (values.name !== product.name) changes.name = values.name;
  if (values.slug !== product.slug) changes.slug = values.slug;
  if (values.sku !== product.sku) changes.sku = values.sku;
  if (description !== product.description) changes.description = description;
  if (brand !== product.brand) changes.brand = brand;
  if (imageUrl !== product.imageUrl) changes.imageUrl = imageUrl;
  if (values.priceCents !== product.priceCents) {
    changes.priceCents = values.priceCents;
  }
  if (compareAtPriceCents !== product.compareAtPriceCents) {
    changes.compareAtPriceCents = compareAtPriceCents;
  }
  if (values.stock !== product.stock) changes.stock = values.stock;
  if (values.categoryId !== product.categoryId) {
    changes.categoryId = values.categoryId;
  }
  if (values.isActive !== product.isActive) changes.isActive = values.isActive;

  return changes;
}

/**
 * La BD guarda centavos enteros y el usuario escribe unidades con decimales
 * (§8.2). El texto se mantiene tal cual se teclea: derivarlo del número en cada
 * pulsación haría imposible escribir "1299." camino de "1299.99".
 */
type MoneyInputProps = {
  id: string;
  name: string;
  value: number | null | undefined;
  invalid: boolean;
  onChange: (cents: number | null) => void;
  onBlur: () => void;
};

function MoneyInput({
  id,
  name,
  value,
  invalid,
  onChange,
  onBlur,
}: MoneyInputProps) {
  const [text, setText] = useState(() =>
    typeof value === "number" ? centsToUnits(value).toFixed(2) : "",
  );

  return (
    <Input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      aria-invalid={invalid}
      value={text}
      onBlur={onBlur}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);

        const normalized = raw.trim().replace(",", ".");

        if (normalized === "") {
          onChange(null);
          return;
        }

        const units = Number(normalized);
        // `NaN` deja que Zod marque el campo en vez de guardar un valor falso.
        onChange(Number.isFinite(units) ? unitsToCents(units) : Number.NaN);
      }}
    />
  );
}

type ProductFormProps = {
  product: ProductListItem | null;
  onClose: () => void;
};

function ProductForm({ product, onClose }: ProductFormProps) {
  const isEditing = product !== null;
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const categoriesQuery = useCategories();
  // En alta el slug sigue al nombre hasta que el usuario lo edita a mano.
  const [slugTouched, setSlugTouched] = useState(isEditing);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<CreateProductInput, unknown, CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: product ? toFormValues(product) : EMPTY_VALUES,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const categories = categoriesQuery.data;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (product) {
        const changes = diffValues(values, product);

        if (Object.keys(changes).length > 0) {
          await updateMutation.mutateAsync({ id: product.id, input: changes });
        }
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: normalizeText(values.description),
          brand: normalizeText(values.brand),
          imageUrl: normalizeText(values.imageUrl),
        });
      }

      onClose();
    } catch (error) {
      // El diálogo permanece abierto: el hook ya notificó por toast y el 409
      // se marca además sobre el campo que lo provoca.
      if (isConflictError(error)) {
        const message = getApiErrorMessage(error, SLUG_TAKEN);

        setError(message.includes("SKU") ? "sku" : "slug", { message });
      }
    }
  });

  const nameField = register("name");

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
          <Input
            id="product-name"
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
          <FieldLabel htmlFor="product-slug">Slug</FieldLabel>
          <Input
            id="product-slug"
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

        <Field data-invalid={Boolean(errors.sku)}>
          <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
          <Input
            id="product-sku"
            autoComplete="off"
            className="uppercase"
            aria-invalid={Boolean(errors.sku)}
            {...register("sku")}
          />
          <FieldDescription>
            Referencia interna única. Se guarda en mayúsculas.
          </FieldDescription>
          <FieldError errors={errors.sku ? [errors.sku] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.categoryId)}>
          <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                value={field.value ? field.value : undefined}
                onValueChange={field.onChange}
                disabled={categoriesQuery.isPending || !categories?.length}
              >
                <SelectTrigger
                  id="product-category"
                  className="w-full"
                  aria-invalid={Boolean(errors.categoryId)}
                >
                  <SelectValue
                    placeholder={
                      categoriesQuery.isPending
                        ? "Cargando categorías..."
                        : "Selecciona una categoría"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {categoriesQuery.isError ? (
            <FieldDescription>
              No se pudieron cargar las categorías. Cierra el diálogo e
              inténtalo de nuevo.
            </FieldDescription>
          ) : null}
          {!categoriesQuery.isPending &&
          !categoriesQuery.isError &&
          !categories?.length ? (
            <FieldDescription>
              Todavía no hay categorías: crea una antes de dar de alta un
              producto.
            </FieldDescription>
          ) : null}
          <FieldError
            errors={errors.categoryId ? [errors.categoryId] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.priceCents)}>
          <FieldLabel htmlFor="product-price">Precio de venta (€)</FieldLabel>
          <Controller
            control={control}
            name="priceCents"
            render={({ field }) => (
              <MoneyInput
                id="product-price"
                name={field.name}
                value={field.value}
                invalid={Boolean(errors.priceCents)}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError
            errors={errors.priceCents ? [errors.priceCents] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.compareAtPriceCents)}>
          <FieldLabel htmlFor="product-compare-price">
            Precio de comparación (€)
          </FieldLabel>
          <Controller
            control={control}
            name="compareAtPriceCents"
            render={({ field }) => (
              <MoneyInput
                id="product-compare-price"
                name={field.name}
                value={field.value}
                invalid={Boolean(errors.compareAtPriceCents)}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
          <FieldDescription>
            Opcional. Es el precio anterior que se muestra tachado: debe ser
            mayor que el precio de venta para que aparezca.
          </FieldDescription>
          <FieldError
            errors={
              errors.compareAtPriceCents ? [errors.compareAtPriceCents] : undefined
            }
          />
        </Field>

        <Field data-invalid={Boolean(errors.stock)}>
          <FieldLabel htmlFor="product-stock">Stock</FieldLabel>
          <Controller
            control={control}
            name="stock"
            render={({ field }) => (
              <Input
                id="product-stock"
                type="number"
                min={0}
                step={1}
                aria-invalid={Boolean(errors.stock)}
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
          <FieldError errors={errors.stock ? [errors.stock] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.brand)}>
          <FieldLabel htmlFor="product-brand">Marca</FieldLabel>
          <Input
            id="product-brand"
            autoComplete="off"
            aria-invalid={Boolean(errors.brand)}
            {...register("brand")}
          />
          <FieldError errors={errors.brand ? [errors.brand] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.imageUrl)}>
          <FieldLabel htmlFor="product-image-url">Imagen (URL)</FieldLabel>
          <Input
            id="product-image-url"
            type="url"
            autoComplete="off"
            placeholder="https://..."
            aria-invalid={Boolean(errors.imageUrl)}
            {...register("imageUrl")}
          />
          <FieldDescription>
            Enlace a una imagen externa. Déjalo vacío si todavía no hay.
          </FieldDescription>
          <FieldError errors={errors.imageUrl ? [errors.imageUrl] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
          <Textarea
            id="product-description"
            rows={3}
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          <FieldError
            errors={errors.description ? [errors.description] : undefined}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="product-is-active">Producto activo</FieldLabel>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="product-is-active"
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
          {isEditing ? "Guardar cambios" : "Crear producto"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductListItem | null;
};

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: ProductFormDialogProps) {
  const isEditing = product !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del producto y guarda los cambios."
              : "Da de alta un producto en el catálogo."}
          </DialogDescription>
        </DialogHeader>

        {/* El contenido se desmonta al cerrar, así que el formulario se
            reinicializa solo; `key` lo fuerza también al cambiar de fila. */}
        <ProductForm
          key={product?.id ?? "new"}
          product={product}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
