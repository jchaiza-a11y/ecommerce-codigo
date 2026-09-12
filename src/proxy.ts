import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import {
  getFirstAllowedAdminPath,
  getRequiredPermission,
} from "@/lib/route-permissions";

const isPublicRoute = createRouteMatcher([
  "/",
  "/products(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Los `GET` del catálogo son públicos para el storefront; sus mutaciones se
  // cierran dentro del propio Route Handler porque `createRouteMatcher` no
  // distingue el método HTTP (003 §8.8).
  "/api/products(.*)",
  "/api/categories(.*)",
  // Read model público de la tienda: solo expone `GET` y no lleva datos de
  // admin. Sin esta entrada el buscador de la landing recibiría un 401 (004 §8.2).
  "/api/storefront(.*)",
  // El webhook de Clerk se autentica con su firma Svix, no con sesión: sin
  // esta entrada `auth.protect()` lo rechazaría con 401.
  "/api/webhooks(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

const FORBIDDEN_MESSAGE = "No tienes permiso para esta acción";

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return;
  }

  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const { pathname } = req.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");

  // Alta por contraseña temporal (§8.4): hasta cambiarla, el único destino
  // posible es el perfil. No aplica a las llamadas de API, que responden solo.
  if (sessionClaims.mustChangePassword === true && !isApiRequest) {
    if (!pathname.startsWith("/profile")) {
      return NextResponse.redirect(new URL("/profile", req.url));
    }

    return;
  }

  if (!isAdminRoute(req)) {
    return;
  }

  // El claim viaja en el JWT y es un caché derivado de Postgres. Si el custom
  // session claim no está configurado llega `undefined`, y se trata como "sin
  // permisos" en vez de dejar pasar (003 §11).
  const permissions = sessionClaims.permissions ?? [];
  const required = getRequiredPermission(pathname);

  if (!required || permissions.includes(required)) {
    return;
  }

  // §8.7: un rol válido sin `dashboard.view` no debe quedar atrapado en la
  // raíz del panel; se le lleva a la primera sección que sí puede ver.
  if (pathname === "/admin") {
    const fallback = getFirstAllowedAdminPath(permissions);

    if (fallback) {
      return NextResponse.redirect(new URL(fallback, req.url));
    }
  }

  if (isApiRequest) {
    return NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
  }

  return NextResponse.redirect(new URL("/admin/forbidden", req.url));
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
