/**
 * URL pública de la app para los `success_url`/`cancel_url` que consume Stripe.
 *
 * Se lee en cada llamada y no en un `const` de módulo: así el error por variable
 * ausente se levanta al crear la sesión —donde el handler lo convierte en un
 * 500 con traza— y no al importar el módulo, que tumbaría rutas que ni la usan.
 * La barra final se recorta para no componer urls con `//`.
 */
export function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL no está configurada");
  }

  return appUrl.replace(/\/$/, "");
}
