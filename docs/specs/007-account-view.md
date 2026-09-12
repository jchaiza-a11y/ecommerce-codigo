---
id: 007
title: Vista de cuenta con perfil, favoritos y compras
status: done
module: profile
scope: client
---

# 007 — Vista de cuenta con perfil, favoritos y compras

## Objetivo
Un usuario autenticado puede abrir `/account` desde el dropdown de su avatar y ver
tres secciones: sus datos de Clerk, sus favoritos y sus compras (las dos últimas vacías).

## Alcance
Incluye:
- Ruta `/account` dentro de `(storefront)` (hereda header/footer), protegida por `proxy.ts`.
- Tabs "Mi perfil" · "Mis favoritos" · "Mis compras".
- "Mi perfil": avatar, nombre, email, username, fecha de alta y último acceso, leídos de Clerk en el servidor.
- Estados vacíos en favoritos y compras, con CTA a `/products`.
- Ítem "Mi cuenta" en el dropdown del `UserButton` que navega a `/account`.

No incluye:
- Servicios, hooks, endpoints, repositorios o tablas de favoritos/compras.
- Edición de datos de Clerk: eso sigue en `/profile` (`UserProfile` prebuilt), que no se toca.
- Cambios en `proxy.ts`: `/account` no está en `isPublicRoute`, así que ya exige sesión.

## Criterios de aceptación
- [ ] AC1 — Dado un usuario con sesión, cuando abre el dropdown del avatar, entonces ve el ítem "Mi cuenta" (con icono) además de los de Clerk, y al pulsarlo llega a `/account`.
- [ ] AC2 — Dado un usuario sin sesión, cuando visita `/account`, entonces `proxy.ts` lo redirige a `/sign-in`.
- [ ] AC3 — Dado un usuario con sesión, cuando entra a `/account`, entonces la pestaña "Mi perfil" está activa y muestra su foto, nombre, email principal y fecha de registro reales de Clerk.
- [ ] AC4 — Dado un usuario sin nombre en Clerk, cuando entra a `/account`, entonces se muestra el username o el email como nombre visible, y el avatar cae a iniciales (`AvatarFallback`), sin campos vacíos ni "undefined".
- [ ] AC5 — Dado cualquier usuario, cuando abre "Mis favoritos" o "Mis compras", entonces ve un estado vacío con título, descripción y botón a `/products`; ninguna de las dos hace peticiones de red.
- [ ] AC6 — La página es Server Component: no aparece `"use client"` en `page.tsx` y solo cruzan la frontera datos primitivos (strings/números), no el objeto `User` de Clerk.

## Datos
Sin cambios de esquema.

## API
Sin endpoints nuevos. Los datos de perfil se leen con `currentUser()` de
`@clerk/nextjs/server` en el Server Component. Sin Zod (no hay entrada de usuario).

## Reutilizar
- `src/components/shared/auth-menu.tsx` — aquí se añade `UserButton.MenuItems` + `UserButton.Link`; el archivo sigue siendo Server Component.
- `src/components/ui/tabs.tsx`, `card.tsx`, `avatar.tsx`, `button.tsx`, `separator.tsx`, `badge.tsx` — ya instalados.
- `src/app/(storefront)/layout.tsx` — la nueva ruta se cuelga de este grupo, no se crea layout propio.
- `src/modules/profile/` — módulo existente (`components/`, `hooks/`, `services/`); los archivos nuevos van ahí.
- `lucide-react` — iconos (`UserRound`, `Heart`, `Package`).

Instalar (única dependencia nueva de UI):
`npx shadcn@latest add empty` — primitivas `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` para AC5. Si el registro fallara, componer el vacío con `Card` + `Button` ya existentes.

Tipos de Clerk verificados en `node_modules/@clerk/react`:
`UserButton.Link` acepta exactamente `{ href: string; label: string; labelIcon: ReactNode }`.

## Tareas
- [x] T1 — Instalar primitiva de estado vacío · `npx shadcn@latest add empty` → `src/components/ui/empty.tsx`
- [x] T2 — Añadir ítem "Mi cuenta" (`UserButton.MenuItems` + `UserButton.Link href="/account"`) · `src/components/shared/auth-menu.tsx`
- [x] T3 — Card de datos de perfil, presentacional y sin hooks, con props primitivas (`imageUrl`, `displayName`, `email`, `username`, `createdAt`, `lastSignInAt`) · `src/modules/profile/components/profile-summary-card.tsx`
- [x] T4 — Sección vacía reutilizable (`icon`, `title`, `description`, CTA a `/products`) sobre `Empty` · `src/modules/profile/components/account-empty-section.tsx`
- [x] T5 — Contenedor de tabs `"use client"` con las tres pestañas, default `profile`, que recibe las props del perfil y monta T3/T4 · `src/modules/profile/components/account-tabs.tsx`
- [x] T6 — Página server: `currentUser()`, `redirect("/sign-in")` si es `null`, derivación de `displayName` (fullName → username → email) y del email principal vía `primaryEmailAddressId`, formateo de fechas con `Intl.DateTimeFormat("es")`, `metadata` "Mi cuenta" · `src/app/(storefront)/account/page.tsx`
- [x] T7 — BUG (hallado en prueba manual): consola muestra `Clerk: <UserProfile /> can only accept <UserProfile.Page /> and <UserProfile.Link /> as its children.` al renderizar el dropdown. Causa raíz: `UserButton.MenuItems`/`UserButton.Link` son componentes marcador que Clerk identifica por igualdad de referencia (`child.type === MenuItems`, ver `node_modules/@clerk/react/dist/hooks-*.mjs`, función `useCustomPages`/`useCustomMenuItems`). Al escribir ese JSX dentro de `auth-menu.tsx` (Server Component) y cruzar la frontera hacia `UserButton` (Client Component), la serialización RSC rompe esa igualdad de referencia. Fix: marcar `src/components/shared/auth-menu.tsx` con `"use client"` para que `UserButton` + `UserButton.MenuItems` + `UserButton.Link` se resuelvan en el mismo módulo cliente. Verificar en el navegador que el warning desaparece y que "Mi cuenta" sigue navegando a `/account`.

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- `/profile` es un catch-all de Clerk (`[[...profile]]`) y el destino del bloqueo por
  `mustChangePassword` en `proxy.ts`; por eso la vista nueva vive en `/account` y no
  cuelga de `/profile`. "Gestionar cuenta" del `UserButton` sigue yendo a `/profile`.
- `currentUser()` devuelve el `User` del Backend API: no tiene `primaryEmailAddress`
  como objeto directo; hay que resolverlo desde `emailAddresses` + `primaryEmailAddressId`.
  `createdAt`/`lastSignInAt` llegan como epoch ms (`lastSignInAt` puede ser `null`).
- `currentUser()` opta por render dinámico; no añadir `export const revalidate`.
- T4 tiene dos consumidores hoy (favoritos y compras) y es el punto de sustitución
  cuando existan los servicios reales; no crear más abstracción alrededor.
