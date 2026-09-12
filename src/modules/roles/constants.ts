/**
 * Constantes del dominio de roles. Este archivo no importa nada del servidor a
 * propósito: lo consumen tanto los Route Handlers como componentes de cliente.
 */

export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
};

/** Los seis roles de sistema del catálogo (003 §5.1). */
export const ROLE_SLUGS = [
  "super_admin",
  "admin",
  "manager",
  "employee",
  "customer",
  "audit",
] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];

/**
 * Única comprobación por slug de rol del proyecto, justificada en 003 §8.3:
 * asignar uno de estos roles es escalamiento de privilegios, no acceso a un
 * recurso, y ningún `permission.code` puede expresarlo. Solo un `super_admin`
 * puede concederlos.
 */
export const PRIVILEGED_ROLE_SLUGS: readonly RoleSlug[] = [
  "super_admin",
  "admin",
];

export const SUPER_ADMIN_ROLE_SLUG: RoleSlug = "super_admin";

export function isPrivilegedRoleSlug(slug: string): boolean {
  return PRIVILEGED_ROLE_SLUGS.includes(slug as RoleSlug);
}
