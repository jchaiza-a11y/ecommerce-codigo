// Import de tipo: se borra en compilación, así este módulo de cliente no
// arrastra `lib/permissions` (marcado `server-only`).
import type { PermissionCode } from "@/lib/permissions";

/**
 * Traducción de cada código a lenguaje llano. El `Record` está tipado por el
 * union completo: añadir un permiso sin su etiqueta rompe `npm run typecheck`
 * en vez de mostrar el código crudo al administrador (AC13).
 */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  "dashboard.view": "Puede entrar al panel de administración",

  "products.view": "Puede ver el catálogo de productos",
  "products.create": "Puede crear productos",
  "products.update": "Puede editar productos",
  "products.delete": "Puede eliminar productos",

  "categories.view": "Puede ver las categorías",
  "categories.create": "Puede crear categorías",
  "categories.update": "Puede editar categorías",
  "categories.delete": "Puede eliminar categorías",

  "users.view": "Puede ver la lista de usuarios",
  "users.create": "Puede dar de alta usuarios",
  "users.update": "Puede editar los datos de un usuario",
  "users.deactivate": "Puede activar y desactivar usuarios",
  "users.assign_roles": "Puede asignar roles a los usuarios",

  "roles.view": "Puede consultar el catálogo de roles",

  "audit_logs.view": "Puede consultar la bitácora de auditoría",

  "finance.view": "Puede consultar ingresos, egresos y márgenes",
  "finance.manage":
    "Puede editar costos de producto y la configuración de Finanzas",
};

/** Cae al propio código si llegara uno que la UI todavía no conoce. */
export function getPermissionLabel(code: string): string {
  return PERMISSION_LABELS[code as PermissionCode] ?? code;
}
