"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  CONFIRM_PASSWORD_ERROR,
  confirmPasswordChanged,
  getApiErrorMessage,
} from "@/modules/profile/services/profile.service";

export function useConfirmPasswordChanged(redirectTo: string) {
  const router = useRouter();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      await confirmPasswordChanged();

      // `proxy.ts` decide con el claim del JWT, no con `publicMetadata`: sin
      // pedir un token fresco el usuario seguiría rebotando a `/profile` hasta
      // que Clerk refrescase la sesión por su cuenta (003 §8.4).
      await getToken({ skipCache: true });
    },
    onSuccess: () => {
      toast.success("Contraseña confirmada. Ya puedes navegar por la app.");
      router.replace(redirectTo);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, CONFIRM_PASSWORD_ERROR));
    },
  });
}
