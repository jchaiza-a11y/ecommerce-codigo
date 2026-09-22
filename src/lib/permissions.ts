import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { getCurrentUser, type CurrentUser } from "@/lib/auth";

/**
 * Catálogo de códigos de permiso del proyecto. La verificación de acceso se
 * hace SIEMPRE contra uno de estos códigos, nunca contra un nombre de rol
 * (CLAUDE.md §4.8). La única excepción documentada es la jerarquía de
 * asignación de roles (003 §8.3), que vive en `modules/roles/constants.ts`.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",

  CATEGORIES_VIEW: "categories.view",
  CATEGORIES_CREATE: "categories.create",
  CATEGORIES_UPDATE: "categories.update",
  CATEGORIES_DELETE: "categories.delete",

  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DEACTIVATE: "users.deactivate",
  USERS_ASSIGN_ROLES: "users.assign_roles",

  ORDERS_VIEW: "orders.view",

  ROLES_VIEW: "roles.view",

  AUDIT_LOGS_VIEW: "audit_logs.view",

  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE: "finance.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CODES: readonly PermissionCode[] =
  Object.values(PERMISSIONS);

export const FORBIDDEN_MESSAGE = "No tienes permiso para esta acción";
const INACTIVE_MESSAGE = "Tu cuenta está desactivada";
const UNAUTHENTICATED_MESSAGE = "Necesitas iniciar sesión";
const UNSYNCED_MESSAGE =
  "Tu cuenta todavía no está sincronizada. Contacta con un administrador.";

/** Un usuario desactivado pierde todo permiso aunque conserve sus roles. */
export function can(code: PermissionCode, user: CurrentUser | null): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  return user.permissions.includes(code);
}

export type PermissionCheck =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse };

/**
 * Guard de Route Handler. Revalida contra Postgres en cada petición, así que
 * revocar un rol corta las mutaciones de inmediato aunque el JWT de la sesión
 * activa siga cacheando los permisos antiguos (003 AC11).
 */
export async function requirePermission(
  code: PermissionCode,
): Promise<PermissionCheck> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: UNAUTHENTICATED_MESSAGE },
        { status: 401 },
      ),
    };
  }

  if (!can(code, user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: user.isActive ? FORBIDDEN_MESSAGE : INACTIVE_MESSAGE },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user };
}

/**
 * Variante para Server Components: no devuelve una respuesta, interrumpe el
 * render. `proxy.ts` ya filtra por ruta; esto es la segunda capa por si la
 * página se alcanza por otro camino.
 */
export async function requirePermissionInPage(
  code: PermissionCode,
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!can(code, user)) {
    // `forbidden()` de Next exige el flag experimental `authInterrupts`; la
    // página 403 propia (T51) cubre el caso sin tocar la configuración.
    redirect("/admin/forbidden");
  }

  return user;
}

export { UNSYNCED_MESSAGE };
