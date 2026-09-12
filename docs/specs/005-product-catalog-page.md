---
id: 005
title: Catálogo filtrable /products + enlaces de la landing
status: done
module: storefront
scope: client
created: 2026-09-04
---

# 005 — Catálogo filtrable `/products` + enlaces de la landing

## Objetivo
Un visitante puede abrir `/products` desde cualquier CTA de la landing y filtrar el
catálogo por categoría, precio, marca y disponibilidad, con la URL como estado.

## Alcance
Incluye: ruta `/products` (aside de filtros + orden + grid + estado vacío) · filtros
multi-categoría, multi-marca, rango de precio, "con stock", "en oferta" · extensión
de `findPublic` y de la query Zod de `/api/storefront/products` · facetas de marca ·
paginación "Ver más" · cableado de los CTA de la landing y del buscador del header.

No incluye: ficha `/products/[slug]` · checkout ni ruta `/checkout` (el botón
"Ir a pagar" del drawer sigue deshabilitado, tal cual está hoy) · favoritos ·
cambios en el carrito (ya completo en 004) · cambios de esquema · botón "Ingresar"
del mockup · rediseño de tokens del mockup (radio 28px, acento lima).

## Criterios de aceptación
- [x] AC1 — Dado un visitante anónimo, cuando abre `/products`, entonces ve el aside
      de filtros y el grid sin redirección a login.
- [x] AC2 — Dado `?category=portatiles,audio&brand=Sony&price=500-1500&inStock=true&onSale=true&sort=price_asc`,
      cuando carga la página, entonces los chips salen marcados y el grid respeta los cinco filtros.
- [x] AC3 — Cuando se activa o desactiva un chip, entonces la URL se actualiza sin
      recargar la página y el contador "X de Y productos" cuadra con `total` de la respuesta.
- [x] AC4 — `price` fuera del enum, `perPage` fuera de rango o `sort` desconocido
      responden `400` con `issues` de Zod, nunca `500`.
- [x] AC5 — El botón "Limpiar" solo aparece si hay algún filtro activo y al pulsarlo
      la URL queda en `/products` limpio.
- [x] AC6 — Sin resultados se pinta el estado vacío "Nada con estos filtros" con su
      botón de limpiar; con `total > items.length` se pinta "Ver más" y al pulsarlo
      se añade la página siguiente sin perder la anterior.
- [x] AC7 — En la landing, los chips de categoría llevan a `/products?category=<slug>`,
      el CTA de ofertas a `/products?onSale=true&sort=discount` y "Ver todo el catálogo"
      a `/products`. Ningún CTA de la landing queda sin destino.
- [x] AC8 — Desde el dropdown del buscador del header, "Ver todos los resultados"
      navega a `/products?q=<término>` y el catálogo abre con ese término aplicado.
- [x] AC9 — Añadir al carrito desde `/products` actualiza el badge y el subtotal del
      drawer igual que en `/`; tras `F5` el carrito sigue ahí.
- [x] AC10 — Estados de carga (skeleton), vacío y error visibles en el grid; los
      precios se formatean con `formatPrice` (EUR, `es-ES`) — el `S/` del mockup es
      solo del lienzo.

## Datos
**Sin cambios de esquema.** `products.brand`, `price_cents`, `stock`,
`compare_at_price_cents` ya existen. Sin migración.

## API
| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/storefront/products` | pública | `category, brand, price, inStock, q, onSale, sort, page, perPage` | `200 StorefrontProductPage` · `400` · `500` |

Params nuevos sobre el contrato de 004 (§6): `category` y `brand` pasan a ser listas
**separadas por coma** (un solo valor sigue siendo válido); `price` es un enum de
rango (`lt500 | 500-1500 | 1500-4000 | gt4000`) que el handler traduce a centavos;
`inStock=true` filtra `stock > 0`. Sin `price` no hay filtro de precio.

Zod: se extiende `storefrontProductQuerySchema` (`category`/`brand` con
`.transform` CSV → `string[]`, `price` con `z.enum(PRICE_RANGE_IDS).optional()`,
`inStock` igual que el `onSale` existente). Sin schema nuevo.

## Reutilizar
- `src/server/repositories/product.repository.ts` — `findPublic`/`countPublic`;
  se extiende `PublicProductFilters` y `publicWhere`, no se duplica la consulta.
- `src/app/api/storefront/products/route.ts` — único handler; ya pagina y valida.
- `src/modules/storefront/services/catalog.service.ts` — `getStorefrontProducts`
  y su `toQueryParams`; solo se amplía el tipo de params.
- `src/modules/storefront/components/product-card.tsx` — la tarjeta del grid **tal
  cual** (badge de descuento, "Sin stock", botón de añadir). No crear otra.
- `src/modules/storefront/components/product-grid-skeleton.tsx` — estado de carga.
- `src/modules/cart/**` — store, drawer y badge ya montados en
  `src/app/(storefront)/layout.tsx`: `/products` los hereda sin tocar nada.
- `src/modules/products/constants.ts` — `formatPrice`. No hay `src/lib/format.ts`.
- `src/components/ui/select.tsx`, `button.tsx`, `badge.tsx`, `scroll-area.tsx`,
  `skeleton.tsx` — ya instalados. **No hace falta instalar ningún componente shadcn**;
  los chips son `Button` (`variant="secondary"` apagado / `default` encendido).
- `src/proxy.ts` — `/products(.*)` ya está en `isPublicRoute`. No tocar.

## Tareas
- [x] T1 — `PublicProductFilters`: `categorySlug` → `categorySlugs?: string[]` (`inArray`) y añadir `brands?: string[]`, `priceMinCents?`, `priceMaxCents?`, `inStock?` en `publicWhere` · `src/server/repositories/product.repository.ts`
- [x] T2 — `findPublicBrands(): Promise<string[]>` (distinct de marcas vivas y activas, orden alfabético) · `src/server/repositories/product.repository.ts`
- [x] T3 — `PRICE_RANGES` (id, label, minCents, maxCents) y extensión de `storefrontProductQuerySchema` · `src/modules/storefront/schemas/catalog.schema.ts`
- [x] T4 — Mapear los params nuevos a los filtros del repositorio · `src/app/api/storefront/products/route.ts`
- [x] T5 — Ampliar `StorefrontProductParams` con `brand`, `price`, `inStock` y arrays · `src/modules/storefront/services/catalog.service.ts`
- [x] T6 — `catalogKeys.list(filters)` y `CATALOG_PER_PAGE` · `src/modules/storefront/constants.ts`
- [x] T7 — `useCatalogFilters`: lee `useSearchParams`, escribe con `window.history.replaceState`, expone `toggle*`, `clearAll`, `hasFilters` · `src/modules/storefront/hooks/use-catalog-filters.ts`
- [x] T8 — `useCatalogProducts`: `useInfiniteQuery` sobre `getStorefrontProducts`, `getNextPageParam` desde `page < totalPages` · `src/modules/storefront/hooks/use-catalog-products.ts`
- [x] T9 — `CatalogFilters` (aside sticky con scroll propio: categoría, precio, marca, disponibilidad, "Limpiar") · `src/modules/storefront/components/catalog-filters.tsx`
- [x] T10 — `CatalogSort` (`Select` con los 4 órdenes de `STOREFRONT_SORTS`) · `src/modules/storefront/components/catalog-sort.tsx`
- [x] T11 — `CatalogResults` (contador "X de Y", grid, skeleton, error, vacío, "Ver más") · `src/modules/storefront/components/catalog-results.tsx`
- [x] T12 — Página `/products`: Server Component con `revalidate = 60` que carga facetas (`findActiveWithProductCount`, `findPublicBrands`, `countPublic({})`) y las pasa al islote cliente · `src/app/(storefront)/products/page.tsx`
- [x] T13 — Chips de categoría de la landing como `Link` a `/products?category=<slug>` · `src/modules/storefront/components/category-chips.tsx`
- [x] T14 — Enlace "Ver todas las ofertas" en la cabecera de la sección · `src/modules/storefront/components/deals-section.tsx`
- [x] T15 — Enlace "Ver todo el catálogo" bajo el grid de novedades · `src/modules/storefront/components/featured-grid.tsx`
- [x] T16 — CTA del hero: "Ver ofertas" → `/products?onSale=true&sort=discount`, "Explorar categorías" → `/products` · `src/modules/storefront/components/hero-bento.tsx`
- [x] T17 — Fila "Ver todos los resultados" al pie del dropdown → `/products?q=<término>` · `src/modules/storefront/components/search-bar.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- **Facetas en servidor, resultados en cliente.** El aside y el total del catálogo se
  renderizan desde el repositorio (una sola consulta por carga); el grid es cliente
  con TanStack Query porque el filtrado es interactivo. Es la misma división que 004 §8.3.
- **`history.replaceState`, no `router.replace`.** `router.replace` vuelve a ejecutar
  el Server Component de T12 en cada chip y refetchea las facetas: doble petición por
  clic. Next.js soporta el `replaceState` nativo para actualizar `searchParams` sin RSC.
- **T1 rompe una firma.** `categorySlug` (singular) lo usa hoy el handler de T4; el
  cambio a `categorySlugs` debe ir en la misma tanda o el typecheck falla.
- **Contador "X de Y".** `Y` es `countPublic({})` sin filtros, no `items.length`;
  calcularlo en cliente daría el total de la página cargada.
- **`useSearchParams` obliga a `<Suspense>`** alrededor del islote cliente en T12 o el
  build de la ruta falla.
- **Marcas sin índice.** `findPublicBrands` hace un `distinct` sobre `brand`; con el
  volumen actual sobra, a revisar si el catálogo crece.
