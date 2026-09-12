// Import de tipo: se borra en compilación, así el bundle de cliente nunca
// arrastra `db` ni Drizzle a través de este reexport.
import type { User } from "@/server/db/schema/user";
import type {
  UserListItem,
  UserRoleSummary,
} from "@/server/repositories/user.repository";

export type { User, UserListItem, UserRoleSummary };

/** El detalle devuelve la misma forma que la fila del listado. */
export type UserDetail = UserListItem;

/**
 * La contraseña temporal viaja **solo** en esta respuesta y una única vez
 * (003 §8.4): no se persiste ni se puede volver a consultar.
 */
export type CreateUserResponse = {
  user: UserDetail;
  temporaryPassword: string;
};
