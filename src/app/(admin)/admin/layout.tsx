import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/shared/admin-sidebar";
import { getCurrentUserState } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const state = await getCurrentUserState();

  if (state.status === "anonymous") {
    redirect("/sign-in");
  }

  // Sin fila en `users` (webhook sin entregar, §11) o cuenta desactivada: no
  // hay panel posible. La salida es `/profile`, que está fuera de `(admin)`;
  // mandarlo a `/admin/forbidden` volvería a pasar por este layout y haría
  // bucle de redirecciones.
  if (state.status === "unsynced" || !state.user.isActive) {
    redirect("/profile");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar permissions={state.user.permissions} />
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
