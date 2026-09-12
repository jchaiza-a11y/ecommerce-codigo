import { NextResponse } from "next/server";

import type { CurrentUser } from "@/lib/auth";
import {
  isPrivilegedRoleSlug,
  SUPER_ADMIN_ROLE_SLUG,
} from "@/modules/roles/constants";

export const USER_NOT_FOUND = "El usuario no existe";
export const EMAIL_TAKEN = "Ya existe un usuario con ese correo electrónico";
export const UNKNOWN_ROLE = "Alguno de los roles seleccionados no existe";
const PRIVILEGE_ESCALATION =
  "Solo un superadministrador puede conceder o retirar los roles de superadministrador y administrador";

/**
 * Excepción documentada en 003 §8.3: es la única comprobación por slug de rol
 * del proyecto. Conceder `super_admin` o `admin` es escalamiento de
 * privilegios, no acceso a un recurso, y ningún `permission.code` puede
 * expresarlo sin inventar un permiso por rol. Vive aquí, como regla de negocio
 * del endpoint, no en el middleware.
 */
export function isSuperAdmin(actor: CurrentUser): boolean {
  return actor.roles.some((role) => role.slug === SUPER_ADMIN_ROLE_SLUG);
}

/**
 * Rechaza el cambio si toca un rol privilegiado y el actor no es
 * `super_admin`. Se miran los roles pedidos **y** los que el destinatario ya
 * tiene: retirarle `super_admin` a alguien es tan sensible como concedérselo.
 */
export function checkRoleHierarchy(
  actor: CurrentUser,
  requestedSlugs: readonly string[],
  currentSlugs: readonly string[] = [],
): NextResponse | null {
  const touchesPrivileged =
    requestedSlugs.some(isPrivilegedRoleSlug) ||
    currentSlugs.some(isPrivilegedRoleSlug);

  if (!touchesPrivileged || isSuperAdmin(actor)) {
    return null;
  }

  return NextResponse.json({ error: PRIVILEGE_ESCALATION }, { status: 403 });
}

/**
 * Contraseña temporal del alta por panel (§8.4). Se devuelve una única vez en
 * el `201` y no se persiste en ninguna tabla propia ni en `audit_logs`.
 */
export function generateTemporaryPassword(): string {
  const raw = crypto.randomUUID().replaceAll("-", "");

  return `${raw.slice(0, 4).toUpperCase()}-${raw.slice(4, 12)}-${raw.slice(12, 16)}#`;
}
