/**
 * Tipado de los datos propios que viajan en Clerk (003 §8.1).
 *
 * `publicMetadata` es un **caché derivado** de Postgres, no la autoridad: sirve
 * para que `proxy.ts` decida en el borde sin consultar la base de datos. Ante
 * cualquier discrepancia gana Postgres, y todo Route Handler mutante revalida
 * contra él con `requirePermission()`.
 */
export {};

declare global {
  interface UserPublicMetadata {
    /** Slugs de rol del usuario. Solo para pintar la UI, nunca para autorizar. */
    roles?: string[];
    /** Códigos de permiso efectivos, deduplicados. */
    permissions?: string[];
    /** Alta por contraseña temporal: fuerza el paso por `/profile` (§8.4). */
    mustChangePassword?: boolean;
    /** Roles pedidos en el alta; el webhook `user.created` los consume (§8.4). */
    pendingRoles?: string[];
  }

  /**
   * Requiere un **custom session token claim** configurado en el Dashboard de
   * Clerk que exponga `publicMetadata` (§12.3). Si no está configurado, estos
   * campos llegan `undefined` y se tratan como "sin permisos".
   */
  interface CustomJwtSessionClaims {
    roles?: string[];
    permissions?: string[];
    mustChangePassword?: boolean;
  }
}
