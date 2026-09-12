"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { userKeys } from "@/modules/users/constants";
import type {
  AssignRolesInput,
  CreateUserInput,
  UpdateUserInput,
} from "@/modules/users/schemas/user.schema";
import {
  assignRoles,
  createUser,
  getApiErrorMessage,
  updateUser,
} from "@/modules/users/services/user.service";

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success("Usuario creado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo crear el usuario"));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      updateUser(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success("Usuario actualizado");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el usuario"));
    },
  });
}

export function useAssignRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignRolesInput }) =>
      assignRoles(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success("Roles actualizados");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudieron asignar los roles"));
    },
  });
}
