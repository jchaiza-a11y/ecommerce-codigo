import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { getCurrentUserState } from "@/lib/auth";
import { UNSYNCED_MESSAGE } from "@/lib/permissions";
import { getFirstAllowedAdminPath } from "@/lib/route-permissions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sin permiso",
  description: "No tienes permiso para ver esta sección.",
};

export default async function ForbiddenPage() {
  const state = await getCurrentUserState();

  // "Sin permisos" y "sin fila en `users`" son problemas distintos (003 §11):
  // el segundo significa que el webhook de Clerk no está entregando eventos y
  // no debe atribuirse a falta de permisos.
  const isUnsynced = state.status === "unsynced";
  const fallback =
    state.status === "ready"
      ? getFirstAllowedAdminPath(state.user.permissions)
      : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" />

      <h1 className="text-2xl font-semibold tracking-tight">
        {isUnsynced ? "Tu cuenta no está lista" : "No tienes permiso"}
      </h1>

      <p className="text-sm text-muted-foreground">
        {isUnsynced
          ? UNSYNCED_MESSAGE
          : "Esta sección requiere un permiso que tu rol no incluye. Si crees que se trata de un error, pídeselo a un administrador."}
      </p>

      <div className="flex gap-3">
        {fallback ? (
          <Button asChild>
            <Link href={fallback}>Ir a la primera sección disponible</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/profile">Ir a mi perfil</Link>
        </Button>
      </div>
    </div>
  );
}
