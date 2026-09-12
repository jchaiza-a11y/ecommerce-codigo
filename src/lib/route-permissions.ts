// Import de tipo: este módulo lo carga `proxy.ts` (Edge) y debe quedarse sin
// dependencias de runtime.
import type { PermissionCode } from "@/lib/permissions";

/**
 * Permiso mínimo por sección de administración. `proxy.ts` resuelve el acceso
 * a `/admin/*` por ruta (003 §8.8); las mutaciones de `/api/products` y
 * `/api/categories` no se pueden resolver aquí porque `createRouteMatcher` no
 * distingue el método HTTP, y se comprueban dentro de su Route Handler.
 *
 * El orden importa: se toma la primera coincidencia, así que `/admin` (el
 * prefijo más genérico) va al final.
 */
const ADMIN_ROUTE_PERMISSIONS: ReadonlyArray<{
  prefix: string;
  permission: PermissionCode;
}> = [
  { prefix: "/admin/products", permission: "products.view" },
  { prefix: "/admin/categories", permission: "categories.view" },
  { prefix: "/admin/users", permission: "users.view" },
  { prefix: "/admin/roles", permission: "roles.view" },
  { prefix: "/admin/audit-logs", permission: "audit_logs.view" },
  { prefix: "/api/admin/users", permission: "users.view" },
  { prefix: "/api/admin/roles", permission: "roles.view" },
  { prefix: "/api/admin/audit-logs", permission: "audit_logs.view" },
  { prefix: "/admin", permission: "dashboard.view" },
];

/**
 * Secciones a las que redirigir cuando el usuario no puede ver el dashboard
 * pero sí otra parte del panel (§8.7). El orden es el del menú.
 */
const ADMIN_SECTION_FALLBACKS: ReadonlyArray<{
  path: string;
  permission: PermissionCode;
}> = [
  { path: "/admin/products", permission: "products.view" },
  { path: "/admin/categories", permission: "categories.view" },
  { path: "/admin/users", permission: "users.view" },
  { path: "/admin/roles", permission: "roles.view" },
  { path: "/admin/audit-logs", permission: "audit_logs.view" },
];

/** Rutas de administración accesibles a cualquier sesión: sin ellas, bucle. */
const UNGUARDED_ADMIN_PREFIXES = ["/admin/forbidden"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getRequiredPermission(
  pathname: string,
): PermissionCode | undefined {
  if (
    UNGUARDED_ADMIN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  ) {
    return undefined;
  }

  return ADMIN_ROUTE_PERMISSIONS.find((entry) =>
    matchesPrefix(pathname, entry.prefix),
  )?.permission;
}

/**
 * Primera sección del panel accesible con estos permisos, o `null` si ninguna.
 * Evita que un rol válido sin `dashboard.view` (caso `audit`) quede atrapado.
 */
export function getFirstAllowedAdminPath(
  permissions: readonly string[],
): string | null {
  return (
    ADMIN_SECTION_FALLBACKS.find((section) =>
      permissions.includes(section.permission),
    )?.path ?? null
  );
}
