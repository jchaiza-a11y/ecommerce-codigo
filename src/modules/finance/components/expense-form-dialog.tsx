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
  EXPENSE_CATEGORY_OPTIONS,
  toDateInputValue,
} from "@/modules/finance/constants";
import {
  useCreateFinanceExpense,
  useUpdateFinanceExpense,
} from "@/modules/finance/hooks/use-finance-expense-mutations";
import {
  createManualExpenseSchema,
  type CreateManualExpenseInput,
  type CreateManualExpenseValues,
  type UpdateManualExpenseInput,
} from "@/modules/finance/schemas/finance.schema";
import type { FinanceExpenseListItem } from "@/modules/finance/types/finance.types";

const EMPTY_VALUES: DefaultValues<CreateManualExpenseInput> = {
  description: "",
};

function toFormValues(
  entry: FinanceExpenseListItem,
): DefaultValues<CreateManualExpenseInput> {
  return {
    amountCents: entry.amountCents,
    category: entry.category ?? undefined,
    occurredAt: toDateInputValue(entry.occurredAt),
    description: entry.description ?? "",
  };
}

/** Solo los campos que el usuario cambió respecto de la fila original. */
function diffValues(
  values: CreateManualExpenseValues,
  entry: FinanceExpenseListItem,
): UpdateManualExpenseInput {
  const changes: UpdateManualExpenseInput = {};
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

type ExpenseFormProps = {
  entry: FinanceExpenseListItem | null;
  onClose: () => void;
};

function ExpenseForm({ entry, onClose }: ExpenseFormProps) {
  const isEditing = entry !== null;
  const createMutation = useCreateFinanceExpense();
  const updateMutation = useUpdateFinanceExpense();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CreateManualExpenseInput, unknown, CreateManualExpenseValues>({
    resolver: zodResolver(createManualExpenseSchema),
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
          <FieldLabel htmlFor="expense-amount">Monto (€)</FieldLabel>
          <Controller
            control={control}
            name="amountCents"
            render={({ field }) => (
              <AmountInput
                id="expense-amount"
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
          <FieldLabel htmlFor="expense-category">Categoría</FieldLabel>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="expense-category"
                  className="w-full"
                  aria-invalid={Boolean(errors.category)}
                >
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_OPTIONS.map((option) => (
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
          <FieldLabel htmlFor="expense-occurred-at">Fecha</FieldLabel>
          <Input
            id="expense-occurred-at"
            type="date"
            aria-invalid={Boolean(errors.occurredAt)}
            {...register("occurredAt")}
          />
          <FieldDescription>
            Fecha del movimiento. Fuera de los últimos 30 días el egreso queda
            en el listado, pero no entra en el Resumen.
          </FieldDescription>
          <FieldError
            errors={errors.occurredAt ? [errors.occurredAt] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="expense-description">Concepto</FieldLabel>
          <Input
            id="expense-description"
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
          {isEditing ? "Guardar cambios" : "Registrar egreso"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FinanceExpenseListItem | null;
};

/** Alta y edición de un egreso manual (016 T13). */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  entry,
}: ExpenseFormDialogProps) {
  const isEditing = entry !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar egreso" : "Nuevo egreso"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del egreso manual y guarda los cambios."
              : "Registra un gasto del negocio que no procede de un pedido."}
          </DialogDescription>
        </DialogHeader>

        {/* El contenido se desmonta al cerrar, así que el formulario se
            reinicializa solo; `key` lo fuerza también al cambiar de fila. */}
        <ExpenseForm
          key={entry?.id ?? "new"}
          entry={entry}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
