import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import * as userRepository from "@/server/repositories/user.repository";

/**
 * Refresca el caché derivado de autorización que viaja en Clerk (003 §8.1).
 *
 * Postgres sigue siendo la autoridad: esto solo alimenta `publicMetadata` para
 * que `proxy.ts` pueda decidir en el borde sin consultar la base de datos. Se
 * usa `updateUserMetadata`, que hace merge profundo, para no pisar
 * `mustChangePassword` ni el resto de claves.
 */
export async function syncClerkAccessMetadata(clerkId: string): Promise<void> {
  const access = await userRepository.findRolesAndPermissionsByClerkId(clerkId);

  if (!access) {
    return;
  }

  const client = await clerkClient();

  await client.users.updateUserMetadata(clerkId, {
    publicMetadata: {
      roles: access.roles.map((role) => role.slug),
      permissions: access.permissionCodes,
      // Los roles pedidos en el alta ya se materializaron en Postgres: se
      // vacían para que un `user.updated` posterior no vuelva a aplicarlos.
      pendingRoles: [],
    },
  });
}

/**
 * Marca el alta por contraseña temporal (§8.4). Se separa del sync de permisos
 * porque solo aplica en la creación desde el panel.
 */
export async function markPendingAccess(
  clerkId: string,
  roleSlugs: readonly string[],
): Promise<void> {
  const client = await clerkClient();

  await client.users.updateUserMetadata(clerkId, {
    publicMetadata: {
      pendingRoles: [...roleSlugs],
      mustChangePassword: true,
    },
  });
}
