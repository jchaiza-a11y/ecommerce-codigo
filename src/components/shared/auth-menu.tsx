"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Client Component a propósito: `UserButton.MenuItems`/`UserButton.Link` son
 * componentes marcador que Clerk detecta por igualdad de referencia
 * (`child.type === MenuItems` en `useCustomMenuItems`). Si este JSX se declara
 * en un Server Component, la frontera RSC rompe esa igualdad, el ítem no se
 * registra y la consola avisa `<UserProfile /> can only accept ...`. Es la
 * excepción a "`use client` lo más abajo posible" (§4.7): `site-header.tsx`
 * sigue siendo Server Component y monta este islote sin cambios.
 * `Show` reemplaza a `SignedIn`/`SignedOut` en Core 3 del SDK (`@clerk/nextjs` ^7): con sesión
 * pendiente se trata como sin sesión (`treatPendingAsSignedOut`, default).
 * El dropdown de `UserButton` trae "Gestionar cuenta" y "Cerrar sesión" ya
 * resueltos por Clerk; se apunta a `/profile`, el mismo `UserProfile`
 * prebuilt que usa el resto del proyecto (sin UI de cuenta a medida).
 * "Mi cuenta" es el ítem propio (007) hacia `/account`: vista de solo lectura
 * con perfil, favoritos y compras. La edición sigue en `/profile`.
 */
export function AuthMenu() {
  return (
    <Show
      when="signed-in"
      fallback={
        <Button asChild variant="outline" size="lg" className="rounded-full px-5">
          <Link href="/sign-in">Ingresar</Link>
        </Button>
      }
    >
      <UserButton
        userProfileMode="navigation"
        userProfileUrl="/profile"
        appearance={{ elements: { userButtonAvatarBox: "size-9" } }}
      >
        <UserButton.MenuItems>
          <UserButton.Link
            href="/account"
            label="Mi cuenta"
            labelIcon={<UserRound className="size-4" />}
          />
        </UserButton.MenuItems>
      </UserButton>
    </Show>
  );
}
