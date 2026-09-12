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
import { RoleAssignmentField } from "@/modules/users/components/role-assignment-field";
import {
  useAssignRoles,
  useCreateUser,
  useUpdateUser,
} from "@/modules/users/hooks/use-user-mutations";
import {
  createUserSchema,
  type CreateUserInput,
} from "@/modules/users/schemas/user.schema";
import {
  getApiErrorMessage,
  isConflictError,
} from "@/modules/users/services/user.service";
import type {
  CreateUserResponse,
  UserListItem,
} from "@/modules/users/types/user.types";

const EMAIL_TAKEN = "Ya existe un usuario con ese correo electrónico";

const EMPTY_VALUES: DefaultValues<CreateUserInput> = {
  email: "",
  firstName: "",
  lastName: "",
  roleSlugs: [],
};

function toFormValues(user: UserListItem): DefaultValues<CreateUserInput> {
  return {
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    roleSlugs: user.roles.map((role) => role.slug),
  };
}

function normalizeText(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

function sameRoleSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

type UserFormProps = {
  user: UserListItem | null;
  canAssignPrivilegedRoles: boolean;
  onClose: () => void;
  onCreated: (response: CreateUserResponse) => void;
};

function UserForm({
  user,
  canAssignPrivilegedRoles,
  onClose,
  onCreated,
}: UserFormProps) {
  const isEditing = user !== null;
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const assignRolesMutation = useAssignRoles();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: user ? toFormValues(user) : EMPTY_VALUES,
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    assignRolesMutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (user) {
        const firstName = values.firstName.trim();
        const lastName = normalizeText(values.lastName);
        const profileChanged =
          firstName !== user.firstName || lastName !== user.lastName;

        if (profileChanged) {
          await updateMutation.mutateAsync({
            id: user.id,
            input: { firstName, lastName },
          });
        }

        // El set de roles tiene su propio endpoint y su propia auditoría: solo
        // se llama si de verdad cambió.
        if (
          !sameRoleSet(
            values.roleSlugs,
            user.roles.map((role) => role.slug),
          )
        ) {
          await assignRolesMutation.mutateAsync({
            id: user.id,
            input: { roleSlugs: values.roleSlugs },
          });
        }
      } else {
        const created = await createMutation.mutateAsync({
          ...values,
          lastName: normalizeText(values.lastName),
        });

        onCreated(created);
      }

      onClose();
    } catch (error) {
      // El diálogo permanece abierto: el hook ya notificó por toast y el 409 se
      // marca además sobre el campo que lo provoca.
      if (isConflictError(error)) {
        setError("email", { message: getApiErrorMessage(error, EMAIL_TAKEN) });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="user-email">Correo electrónico</FieldLabel>
          <Input
            id="user-email"
            type="email"
            autoComplete="off"
            readOnly={isEditing}
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          <FieldDescription>
            {isEditing
              ? "El correo es la identidad de la cuenta en Clerk y no se edita desde aquí."
              : "Será su identificador de acceso. Se le entregará una contraseña temporal."}
          </FieldDescription>
          <FieldError errors={errors.email ? [errors.email] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.firstName)}>
          <FieldLabel htmlFor="user-first-name">Nombre</FieldLabel>
          <Input
            id="user-first-name"
            autoComplete="off"
            aria-invalid={Boolean(errors.firstName)}
            {...register("firstName")}
          />
          <FieldError
            errors={errors.firstName ? [errors.firstName] : undefined}
          />
        </Field>

        <Field data-invalid={Boolean(errors.lastName)}>
          <FieldLabel htmlFor="user-last-name">Apellidos</FieldLabel>
          <Input
            id="user-last-name"
            autoComplete="off"
            aria-invalid={Boolean(errors.lastName)}
            {...register("lastName")}
          />
          <FieldError errors={errors.lastName ? [errors.lastName] : undefined} />
        </Field>

        <Field data-invalid={Boolean(errors.roleSlugs)}>
          <FieldLabel htmlFor="user-roles">Roles</FieldLabel>
          <Controller
            control={control}
            name="roleSlugs"
            render={({ field }) => (
              <RoleAssignmentField
                value={field.value ?? []}
                onChange={field.onChange}
                canAssignPrivilegedRoles={canAssignPrivilegedRoles}
                disabled={isPending}
              />
            )}
          />
          <FieldError
            errors={errors.roleSlugs ? [errors.roleSlugs] : undefined}
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
          {isEditing ? "Guardar cambios" : "Crear usuario"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem | null;
  canAssignPrivilegedRoles: boolean;
  onCreated: (response: CreateUserResponse) => void;
};

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  canAssignPrivilegedRoles,
  onCreated,
}: UserFormDialogProps) {
  const isEditing = user !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar usuario" : "Nuevo usuario"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Actualiza sus datos y los roles que tiene asignados."
              : "Se creará su cuenta con una contraseña temporal que verás una sola vez."}
          </DialogDescription>
        </DialogHeader>

        {/* El contenido se desmonta al cerrar, así que el formulario se
            reinicializa solo; `key` lo fuerza también al cambiar de fila. */}
        <UserForm
          key={user?.id ?? "new"}
          user={user}
          canAssignPrivilegedRoles={canAssignPrivilegedRoles}
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
