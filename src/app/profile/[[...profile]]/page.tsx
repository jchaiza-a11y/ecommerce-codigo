import type { Metadata } from "next";
import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { getCurrentUserState } from "@/lib/auth";
import { getFirstAllowedAdminPath } from "@/lib/route-permissions";
import { PasswordChangeNotice } from "@/modules/profile/components/password-change-notice";

export const metadata: Metadata = {
  title: "Mi perfil",
  description: "Consulta tus datos y cambia tu contraseña.",
};

/**
 * Fuera de `(admin)` a propósito (003 §8.9): cualquier usuario autenticado
 * —incluidos `employee` y `customer`, que no tienen permisos de panel— debe
 * poder ver sus datos y cambiar su contraseña. Se reutiliza el componente
 * prebuilt de Clerk, igual que en `sign-in` / `sign-up`, sin UI a medida.
 */
export default async function ProfilePage() {
  // Se lee el mismo claim que evalúa `proxy.ts`, no `publicMetadata`: así el
  // aviso aparece exactamente cuando el usuario está encerrado aquí, y
  // desaparece en cuanto el token se refresca tras confirmar (§8.4).
  const { sessionClaims } = await auth();
  const mustChangePassword = sessionClaims?.mustChangePassword === true;

  const state = mustChangePassword ? await getCurrentUserState() : null;
  const redirectTo =
    state?.status === "ready"
      ? (getFirstAllowedAdminPath(state.user.permissions) ?? "/")
      : "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      {mustChangePassword ? (
        <div className="w-full max-w-2xl">
          <PasswordChangeNotice redirectTo={redirectTo} />
        </div>
      ) : null}

      <UserProfile />
    </div>
  );
}
