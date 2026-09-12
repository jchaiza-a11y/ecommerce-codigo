const OPTIMIZABLE_IMAGE_HOSTS = new Set(["images.unsplash.com"]);

/**
 * Debe reflejar exactamente los hosts de `images.remotePatterns` en
 * `next.config.ts`. `next/image` solo optimiza esos hosts; para cualquier otro
 * (fotos de producto que un admin pega desde cualquier proveedor) hay que
 * pasar `unoptimized` al componente o el optimizador revienta en runtime.
 * `null`/URL inválida cuenta como optimizable porque cae al placeholder local.
 */
export function isOptimizableImageUrl(imageUrl: string | null): boolean {
  if (!imageUrl) return true;

  try {
    return OPTIMIZABLE_IMAGE_HOSTS.has(new URL(imageUrl).hostname);
  } catch {
    return true;
  }
}
