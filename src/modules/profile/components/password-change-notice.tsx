"use client";

import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConfirmPasswordChanged } from "@/modules/profile/hooks/use-confirm-password-changed";
import {
  CONFIRM_PASSWORD_ERROR,
  getApiErrorMessage,
} from "@/modules/profile/services/profile.service";

type PasswordChangeNoticeProps = {
  /** Destino tras confirmar: primera sección del panel accesible, o la home. */
  redirectTo: string;
};

/**
 * Cierre del alta por contraseña temporal (003 §8.4, AC8). Sin este paso el
 * usuario creado desde el panel quedaría encerrado en `/profile` para siempre,
 * porque nada volvería `mustChangePassword` a `false`.
 */
export function PasswordChangeNotice({
  redirectTo,
}: PasswordChangeNoticeProps) {
  const confirm = useConfirmPasswordChanged(redirectTo);

  return (
    <Card className="w-full border-amber-500/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-amber-600" />
          Cambia tu contraseña temporal
        </CardTitle>
        <CardDescription>
          Tu cuenta se creó con una contraseña temporal. Cámbiala más abajo, en
          la sección Seguridad, y después confírmalo aquí: hasta entonces no
          podrás salir de esta página.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <Button
          type="button"
          className="self-start"
          onClick={() => confirm.mutate()}
          disabled={confirm.isPending}
        >
          {confirm.isPending ? "Confirmando…" : "Ya cambié mi contraseña"}
        </Button>

        {confirm.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(confirm.error, CONFIRM_PASSWORD_ERROR)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
