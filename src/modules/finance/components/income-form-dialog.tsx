"use client";

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
import { AmountInput } from "@/modules/finance/components/amount-input";
import {
  INCOME_CATEGORY_OPTIONS,
  toDateInputValue,
} from "@/modules/finance/constants";
import {
  useCreateFinanceIncome,
  useUpdateFinanceIncome,
} from "@/modules/finance/hooks/use-finance-income-mutations";
import {
  createManualIncomeSchema,
  type CreateManualIncomeInput,
  type CreateManualIncomeValues,
  type UpdateManualIncomeInput,
} from "@/modules/finance/schemas/finance.schema";
import type { FinanceIncomeListItem } from "@/modules/finance/types/finance.types";

const EMPTY_VALUES: DefaultValues<CreateManualIncomeInput> = {
  description: "",
};

function toFormValues(
  entry: FinanceIncomeListItem,
): DefaultValues<CreateManualIncomeInput> {
  return {
    amountCents: entry.amountCents,
    category: entry.category ?? undefined,
    occurredAt: toDateInputValue(entry.occurredAt),
    description: entry.description ?? "",
  };
}

/** Solo los campos que el usuario cambió respecto de la fila original. */
function diffValues(
  values: CreateManualIncomeValues,
  entry: FinanceIncomeListItem,
): UpdateManualIncomeInput {
  const changes: UpdateManualIncomeInput = {};
  // La cadena vacía es cómo se borra la descripción: el handler la guarda como
  // `null`. `undefined` significaría "no tocar el campo".
  const description = values.description ?? "";

  if (values.amountCents !== entry.amountCents) {
    changes.amountCents = values.amountCents;
  }
  if (values.category !== entry.category) {
    changes.category = values.category;
  }
  if (values.occurredAt.getTime() !== new Date(entry.occurredAt).getTime()) {
    changes.occurredAt = values.occurredAt;
  }
  if (description !== (entry.description ?? "")) {
    changes.description = description;
  }

  return changes;
}

type IncomeFormProps = {
  entry: FinanceIncomeListItem | null;
  onClose: () => void;
};

function IncomeForm({ entry, onClose }: IncomeFormProps) {
  const isEditing = entry !== null;
  const createMutation = useCreateFinanceIncome();
  const updateMutation = useUpdateFinanceIncome();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CreateManualIncomeInput, unknown, CreateManualIncomeValues>({
    resolver: zodResolver(createManualIncomeSchema),
    defaultValues: entry
      ? toFormValues(entry)
      : { ...EMPTY_VALUES, occurredAt: toDateInputValue(new Date()) },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (entry) {
        const changes = diffValues(values, entry);

        if (Object.keys(changes).length > 0) {
          await updateMutation.mutateAsync({ id: entry.id, input: changes });
        }
      } else {
        await createMutation.mutateAsync(values);
      }

      onClose();
    } catch {
      // El hook ya notificó el error por toast; el diálogo sigue abierto con lo
      // tecleado para permitir reintentar.
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.amountCents)}>
          <FieldLabel htmlFor="income-amount">Monto (€)</FieldLabel>
          <Controller
            control={control}
            name="amountCents"
            render={({ field }) => (
              <AmountInput
                id="income-amount"
                name={field.name}
                value={field.value}
                invalid={Boolean(errors.amountCents)}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError
            errors={errors.amountCents ? [errors.amountCents] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.category)}>
          <FieldLabel htmlFor="income-category">Categoría</FieldLabel>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="income-category"
                  className="w-full"
                  aria-invalid={Boolean(errors.category)}
                >
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError
            errors={errors.category ? [errors.category] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.occurredAt)}>
          <FieldLabel htmlFor="income-occurred-at">Fecha</FieldLabel>
          <Input
            id="income-occurred-at"
            type="date"
            aria-invalid={Boolean(errors.occurredAt)}
            {...register("occurredAt")}
          />
          <FieldDescription>
            Fecha del movimiento. Fuera de los últimos 30 días el ingreso queda
            en el listado, pero no entra en el Resumen.
          </FieldDescription>
          <FieldError
            errors={errors.occurredAt ? [errors.occurredAt] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="income-description">Concepto</FieldLabel>
          <Input
            id="income-description"
            autoComplete="off"
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          <FieldDescription>Opcional. Máximo 200 caracteres.</FieldDescription>
          <FieldError
            errors={errors.description ? [errors.description] : undefined}
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
          {isEditing ? "Guardar cambios" : "Registrar ingreso"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type IncomeFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FinanceIncomeListItem | null;
};

/** Alta y edición de un ingreso manual (016 T12). */
export function IncomeFormDialog({
  open,
  onOpenChange,
  entry,
}: IncomeFormDialogProps) {
  const isEditing = entry !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar ingreso" : "Nuevo ingreso"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del ingreso manual y guarda los cambios."
              : "Registra un ingreso que no procede de un pedido de la tienda."}
          </DialogDescription>
        </DialogHeader>

        {/* El contenido se desmonta al cerrar, así que el formulario se
            reinicializa solo; `key` lo fuerza también al cambiar de fila. */}
        <IncomeForm
          key={entry?.id ?? "new"}
          entry={entry}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
