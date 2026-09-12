import "server-only";

import { cache } from "react";
import { auth } from "@clerk/nextjs/server";

import type { PermissionCode } from "@/lib/permissions";
import * as userRepository from "@/server/repositories/user.repository";
import type { UserRoleSummary } from "@/server/repositories/user.repository";

export type CurrentUser = {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  roles: UserRoleSummary[];
  /** Set efectivo resuelto en Postgres, no el caché del JWT. */
  permissions: PermissionCode[];
};

/**
 * "Sin permisos" y "sin fila en `users`" son estados distintos (003 §11): el
 * segundo significa que el webhook de Clerk no está entregando eventos, y el
 * mensaje al usuario no debe atribuirlo a falta de permisos.
 */
export type CurrentUserState =
  | { status: "anonymous" }
  | { status: "unsynced"; clerkId: string }
  | { status: "ready"; user: CurrentUser };

/**
 * `cache()` de React memoiza por request: layout, página y Route Handler
 * comparten una única consulta de acceso en la misma petición.
 */
export const getCurrentUserState = cache(
  async (): Promise<CurrentUserState> => {
    const { userId } = await auth();

    if (!userId) {
      return { status: "anonymous" };
    }

    const access =
      await userRepository.findRolesAndPermissionsByClerkId(userId);

    if (!access) {
      return { status: "unsynced", clerkId: userId };
    }

    return {
      status: "ready",
      user: {
        id: access.user.id,
        clerkId: access.user.clerkId,
        email: access.user.email,
        firstName: access.user.firstName,
        lastName: access.user.lastName,
        isActive: access.user.isActive,
        roles: access.roles,
        permissions: access.permissionCodes as PermissionCode[],
      },
    };
  },
);

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await getCurrentUserState();

  return state.status === "ready" ? state.user : null;
}
