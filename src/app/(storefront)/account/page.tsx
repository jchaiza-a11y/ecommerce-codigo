import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";

import { AccountTabs } from "@/modules/profile/components/account-tabs";
import { parseAccountTab } from "@/modules/profile/constants";

/** Next.js 16 entrega los `searchParams` como `Promise`. */
type SearchParams = Promise<{ tab?: string; session_id?: string }>;

export const metadata: Metadata = {
  title: "Mi cuenta",
  description:
    "Consulta tus datos de perfil, tus favoritos, tus compras y tus tarjetas.",
};

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Vista de cuenta (007). `currentUser()` devuelve el `User` del Backend API, que
 * es una clase con getters: no es serializable hacia el cliente, así que aquí se
 * derivan primitivas y solo esas cruzan la frontera (AC6). La ruta ya exige
 * sesión en `proxy.ts`; el `redirect` es la red de seguridad del servidor.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [user, { tab, session_id: setupSessionId }] = await Promise.all([
    currentUser(),
    searchParams,
  ]);

  if (!user) {
    redirect("/sign-in");
  }

  // El `User` del Backend API no expone `primaryEmailAddress` como objeto: se
  // resuelve por id, con la primera dirección como respaldo (AC4).
  const primaryEmail =
    user.emailAddresses.find(
      (address) => address.id === user.primaryEmailAddressId,
    )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

  const displayName =
    user.fullName ?? user.username ?? primaryEmail ?? "Mi cuenta";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Mi cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Tus datos, tus favoritos y tus compras en un solo lugar.
        </p>
      </header>

      <AccountTabs
        imageUrl={user.imageUrl}
        displayName={displayName}
        email={primaryEmail ?? "Sin correo registrado"}
        username={user.username}
        createdAt={dateFormatter.format(new Date(user.createdAt))}
        lastSignInAt={
          user.lastSignInAt === null
            ? null
            : dateTimeFormatter.format(new Date(user.lastSignInAt))
        }
        defaultTab={parseAccountTab(tab)}
        setupSessionId={setupSessionId ?? null}
      />
    </div>
  );
}
