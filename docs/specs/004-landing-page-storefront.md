---
id: 4
title: Landing page del storefront + API pública de catálogo — Fase 4
status: done
module: storefront
scope: client
created: 2026-09-02
---

# 004 — Landing page del storefront + API pública de catálogo (Fase 4)

## 1. Contexto

`/` sigue siendo el scaffold de `create-next-app` (`src/app/page.tsx`) y
`src/app/(storefront)/` está **vacío**. El catálogo ya existe en admin (001, 002) y
el RBAC cierra las mutaciones (003), pero los `GET` públicos de `/api/products` y
`/api/categories` devuelven la **fila completa de admin** (`sku`, `stock`,
`deletedAt`, `isActive`) e **incluyen productos inactivos**: no sirven como API de
tienda. `src/hooks/` está vacío y `db:seed` solo siembra permisos y roles, no catálogo.

## 2. Objetivo

Un visitante anónimo entra a `/` y ve una landing con hero, ofertas, categorías y
destacados renderizados desde datos reales, puede buscar productos y añadirlos a un
carrito local que persiste al recargar.

## 3. Alcance

**Incluye:** API pública de lectura `/api/storefront/*` con paginación, filtro,
búsqueda y orden · lectura desde repositorio en Server Components · landing en
`(storefront)/page.tsx` con header sticky, hero bento, ofertas con countdown,
chips de categorías, grid de destacados, newsletter y footer · carrito en Zustand
persistido en `localStorage` + drawer · animaciones con `motion` · carruseles con
`swiper` · tokens de marca y fuentes · seed de catálogo demo.

**No incluye:** ficha `/products/[slug]` · catálogo `/products` · checkout, `carts`
en BD ni `orders` · reviews/rating reales · subida de imágenes · newsletter
persistida (§8.6) · cambios de esquema (§5).

## 4. Criterios de aceptación

- [ ] AC1 — Dado un visitante anónimo, cuando abre `/`, entonces ve la landing sin
      redirección a login y con el HTML de productos ya presente en la respuesta (SSR).
- [ ] AC2 — `GET /api/storefront/products` **nunca** devuelve `sku`, `stock`,
      `deletedAt`, `isActive`, ni filas con `is_active = false` o `deleted_at` informado.
- [ ] AC3 — `?category=<slug>&q=<texto>&sort=price_asc&page=2&perPage=12` filtra,
      ordena y pagina; `total` y `totalPages` son coherentes con el filtro aplicado.
- [ ] AC4 — Un `perPage` fuera de rango o un `sort` desconocido responden `400` con
      `issues` de Zod, nunca `500`.
- [ ] AC5 — Escribir en el buscador dispara **una** petición tras 300 ms de pausa
      (debounce) y el dropdown muestra productos y categorías coincidentes, o vacío.
- [ ] AC6 — Añadir un producto actualiza el badge del header, abre el drawer y el
      subtotal cuadra; tras `F5` el carrito sigue ahí y no hay error de hidratación.
- [ ] AC7 — Un producto con `compareAtPriceCents > priceCents` muestra el badge de
      % de descuento y el precio anterior tachado; si no, no se pinta nada (002 §8.5).
- [ ] AC8 — Todos los precios se formatean con `formatPrice` desde centavos; no hay
      ninguna división por 100 suelta en un componente.
- [ ] AC9 — Con `prefers-reduced-motion: reduce` las animaciones de `motion` no se
      ejecutan (sin desplazamientos ni fades); el contenido queda visible.
- [ ] AC10 — Estados de carga (skeleton), vacío ("aún no hay productos") y error
      visibles en cada sección que consume datos.
- [ ] AC11 — Sin `DATABASE_URL` disponible la landing muestra el estado de error de
      cada sección; no lanza una excepción sin capturar que tumbe `/`.

## 5. Datos

**Sin cambios de esquema.** `products` ya tiene `price_cents`,
`compare_at_price_cents`, `image_url`, `brand`, `is_active`, `deleted_at`;
`categories` tiene `slug`, `is_active`, `sort_order`. Sin migración.

Lo que el diseño pide y **no** existe en BD — decisión en §8.1 (omitir, no inventar):
`rating`/`review_count`, badge "Más vendido", fecha de fin de oferta.

Seed demo (T18): 5 categorías + ~16 productos, idempotente (no inserta si ya hay
filas), con `image_url` de `images.unsplash.com` y varios con precio de comparación.

## 6. Contratos de API

| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/storefront/products` | pública | `category, q, sort, onSale, page, perPage` | `200 StorefrontProductPage` · `400` · `500` |
| GET | `/api/storefront/categories` | pública | — | `200 StorefrontCategory[]` · `500` |

```
StorefrontProduct  = { id, name, slug, brand, description, priceCents,
                       compareAtPriceCents, discountPercent, imageUrl,
                       categorySlug, categoryName, inStock, isNew }
StorefrontProductPage = { items, page, perPage, total, totalPages }
StorefrontCategory = { id, name, slug, productCount }
```

- `inStock = stock > 0` (booleano; no se expone el inventario). `isNew = createdAt`
  dentro de los últimos 30 días. `discountPercent` calculado solo si
  `compareAtPriceCents > priceCents`, redondeado hacia abajo.
- `sort ∈ newest | price_asc | price_desc | discount` (default `newest`).
  `perPage` 1–48 (default 12), `page ≥ 1`. `q` busca en `name` y `brand` (`ilike`).
- `categories` devuelve solo activas, ordenadas por `sort_order`, con `productCount`
  de productos vivos y activos (agregado en el join, no N+1).

**Zod** (`src/modules/storefront/schemas/catalog.schema.ts`):
`storefrontProductQuerySchema` (coerción desde `searchParams`, `.default()` en
`sort`, `page`, `perPage`), `storefrontProductSchema`, `storefrontCategorySchema`.
Los tipos de fila se infieren del schema Drizzle; los Zod validan **entrada**.

## 7. Reutilizar (verificado)

- `src/modules/products/constants.ts` — `formatPrice`, `centsToUnits`. Módulo puro,
  sin imports de servidor: seguro en cliente. **No** reimplementar el formateo.
- `src/lib/axios.ts` (`api`) · `src/lib/utils.ts` (`cn`) ·
  `src/components/providers/query-provider.tsx` y `theme-provider.tsx` (ya montados
  en `src/app/layout.tsx`, `next-themes` ya instalado).
- `src/server/repositories/product.repository.ts` / `category.repository.ts` —
  se **extienden** con funciones nuevas; no se tocan las existentes (las usa admin).
- Patrón de service/hook a copiar: `product.service.ts` (`getApiErrorMessage`),
  `use-products.ts`, `constants.ts` (`productKeys`).
- shadcn ya instalados: `button, card, badge, input, sheet, separator, skeleton,
  popover, tooltip, dropdown-menu, sonner`. **Instalar uno:**
  `npx shadcn@latest add scroll-area` (lista del drawer y fila de chips).
- Dependencias nuevas: `npm i motion swiper`. Nada más; el resto del diseño se
  resuelve con Tailwind 4 y los componentes ya presentes.

## 8. Decisiones técnicas

**8.1 Sin columnas nuevas — CONFIRMAR AL APROBAR.** El mockup muestra rating con
estrellas, "Más vendido" y un countdown de oferta. No hay tabla `reviews`, ni
`orders`, ni `deal_ends_at`. Se decide **no** inventar columnas ni datos falsos:
(a) las estrellas y "Más vendido" **se omiten** de la UI en esta fase; la mini-tarjeta
de rating del hero se sustituye por una de confianza (envío, garantía, devoluciones);
(b) el countdown existe pero es **cosmético**: cuenta al fin del día local, y así se
documenta en el código. Alternativa si el usuario prefiere: añadir
`rating_avg`, `review_count` y `deal_ends_at` a `products` — implica migración y
UI de admin para editarlos, y sale de esta fase.

**8.2 Endpoints nuevos, no modificar los existentes.** Cambiar la forma de
`GET /api/products` rompería `ProductListItem` y la tabla de admin. El storefront
estrena su propio *read model* bajo `/api/storefront/`, alineado con el grupo de
rutas `(storefront)`. Es un namespace nuevo respecto a `docs/SETUP.md` §3 y se
justifica igual que `/api/admin/`: audiencia distinta, campos distintos.
Requiere añadir `"/api/storefront(.*)"` a `isPublicRoute` en `src/proxy.ts`.

**8.3 Server Components leen del repositorio; el cliente usa la API.** `docs/SETUP.md`
§4 lo permite explícitamente. La landing renderiza sus secciones en servidor
(SEO + sin waterfall) llamando al repositorio, y pasa los datos como props a los
islotes cliente. Los endpoints los consume solo lo interactivo: buscador
(`useProductSearch`) y chips de categoría del dropdown (`useStorefrontCategories`).
No se duplica lógica: ambos caminos entran por la misma función de repositorio.

**8.4 Carrito en Zustand + `persist`.** Es estado de cliente (CLAUDE.md §4.6). Guarda
`{ productId, quantity }` más un snapshot de presentación (`name, slug, priceCents,
imageUrl`) para pintar el drawer sin pedir nada. El snapshot **no** es fuente de
verdad de precio: el checkout (fase futura) recalculará contra la BD. `persist` con
`skipHydration` + hidratación en un `useEffect` para no romper el SSR (§10).

**8.5 Imágenes.** Se usa `image_url` (nullable). `next.config.ts` añade
`images.remotePatterns` con `images.unsplash.com` (host del seed). Un producto sin
imagen o de un host no permitido cae en un placeholder propio. Riesgo asumido en §10;
la subida real de archivos va en su propia spec.

**8.6 Newsletter sin backend.** Valida el email con Zod en cliente y muestra un
toast de confirmación. No persiste nada, no llama a ninguna API. Es deliberado y
está documentado en el propio componente para que no se lea como un bug.

**8.7 Tema y tokens.** Se **añaden** `--brand` (violeta) y `--brand-2` (cian) en
`:root` y `.dark` y se mapean en `@theme inline` como `--color-brand`/`--color-brand-2`.
**No** se sobrescriben `--primary`, `--accent` ni `--secondary`: shadcn los usa en
todo el panel de admin y cambiarlos repinta 003 sin querer. Fuentes: `Space_Grotesk`
→ `--font-heading` y `Plus_Jakarta_Sans` → `--font-sans` vía `next/font/google` en
`src/app/layout.tsx`. Ojo: hoy `@theme` declara `--font-sans: var(--font-sans)` pero
el layout solo define `--font-geist-sans`, así que la variable está **sin resolver**;
este cambio la arregla.

**8.8 Animaciones.** `motion` solo en islotes cliente: stagger de entrada del hero,
`whileHover`/`whileTap` en tarjetas y botones, `whileInView` con `viewport={{ once: true }}`
para el reveal de secciones, y transición del drawer. `<MotionConfig reducedMotion="user">`
en el layout del storefront cubre AC9 de una vez. Sin animar `width`/`height`
(solo `opacity` y `transform`). `swiper` se monta solo en el carrusel de ofertas y en
la fila de chips móvil, con `import "swiper/css"` local al componente.

## 9. Tareas

- [x] T1 — Instalar dependencias · `npm i motion swiper` + `npx shadcn@latest add scroll-area`
- [x] T2 — Tokens de marca `--brand`/`--brand-2` y mapeo `@theme` (sin tocar los de shadcn) · `src/app/globals.css`
- [x] T3 — Fuentes Space Grotesk + Plus Jakarta Sans y `metadata` real · `src/app/layout.tsx`
- [x] T4 — `images.remotePatterns` · `next.config.ts`
- [x] T5 — `findPublic(filters)`, `countPublic(filters)` (activos, `deleted_at IS NULL`, join a categoría) · `src/server/repositories/product.repository.ts`
- [x] T6 — `findActiveWithProductCount()` · `src/server/repositories/category.repository.ts`
- [x] T7 — Schemas Zod de query y de salida · `src/modules/storefront/schemas/catalog.schema.ts`
- [x] T8 — Mapper fila → `StorefrontProduct` (`discountPercent`, `inStock`, `isNew`) · `src/modules/storefront/lib/to-storefront-product.ts`
- [x] T9 — `GET` paginado · `src/app/api/storefront/products/route.ts`
- [x] T10 — `GET` de categorías · `src/app/api/storefront/categories/route.ts`
- [x] T11 — Añadir `/api/storefront(.*)` a rutas públicas · `src/proxy.ts`
- [x] T12 — Service axios · `src/modules/storefront/services/catalog.service.ts`
- [x] T13 — `useDebounce` transversal · `src/hooks/use-debounce.ts`
- [x] T14 — `catalogKeys` + `useProductSearch` / `useStorefrontCategories` · `src/modules/storefront/constants.ts` y `hooks/`
- [x] T15 — Store del carrito con `persist` · `src/modules/cart/store/cart.store.ts`
- [x] T16 — `CartDrawer` (sheet, stepper, subtotal, "Ir a pagar" deshabilitado por §3) · `src/modules/cart/components/cart-drawer.tsx`
- [x] T17 — `CartButton` con badge de cantidad · `src/modules/cart/components/cart-button.tsx`
- [x] T18 — Seed demo idempotente de categorías y productos · `src/server/db/seed.ts`
- [x] T19 — `ProductCard` (imagen con placeholder, badge de descuento, `formatPrice`, añadir al carrito) · `src/modules/storefront/components/product-card.tsx`
- [x] T20 — `SearchBar` con debounce y dropdown de resultados · `src/modules/storefront/components/search-bar.tsx`
- [x] T21 — `ThemeToggle` · `src/components/shared/theme-toggle.tsx`
- [x] T22 — `SiteHeader` sticky (server, con los islotes de T17/T20/T21) · `src/components/shared/site-header.tsx`
- [x] T23 — `SiteFooter` · `src/components/shared/site-footer.tsx`
- [x] T24 — `SectionReveal` (wrapper `motion` reutilizable) · `src/modules/storefront/components/section-reveal.tsx`
- [x] T25 — `HeroBento` con stagger · `src/modules/storefront/components/hero-bento.tsx`
- [x] T26 — `DealsCountdown` (cliente, cosmético §8.1) · `src/modules/storefront/components/deals-countdown.tsx`
- [x] T27 — `DealsSection` (grid desktop / swiper móvil) · `src/modules/storefront/components/deals-section.tsx`
- [x] T28 — `CategoryChips` scrollable · `src/modules/storefront/components/category-chips.tsx`
- [x] T29 — `FeaturedGrid` · `src/modules/storefront/components/featured-grid.tsx`
- [x] T30 — `NewsletterForm` (§8.6) · `src/modules/storefront/components/newsletter-form.tsx`
- [x] T31 — Layout del storefront: header, footer, `MotionConfig`, montaje del drawer · `src/app/(storefront)/layout.tsx`
- [x] T32 — **Borrar** `src/app/page.tsx` (scaffold) y crear la home que compone las secciones desde el repositorio · `src/app/(storefront)/page.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## 10. Riesgos

- **Ruta `/` duplicada:** `src/app/page.tsx` y `(storefront)/page.tsx` resuelven la
  misma URL; si T32 no borra el scaffold, el build falla. Van en la misma tarea.
- **Hidratación del carrito:** `persist` sin `skipHydration` pinta el badge del
  servidor con 0 y el del cliente con N → error de hidratación. Hidratar en efecto.
- **Fuga de datos:** el mapper de T8 es el único punto que construye la respuesta
  pública. Devolver la fila cruda de Drizzle desde el handler expone `sku` y `stock`
  y rompe AC2; es hallazgo bloqueante.
- **`ilike` sin índice:** `q` hace `ilike '%…%'` sobre `name`/`brand` sin índice
  trigram. Aceptable con el volumen de esta fase; a revisar si el catálogo crece.
- **Imagen de host no permitido:** un `image_url` de admin fuera de `remotePatterns`
  hace fallar el optimizador en runtime. El placeholder cubre `null`, no el host
  inválido. Se acepta hasta la spec de subida de imágenes.
- **`swiper` en SSR:** importa CSS y toca `window`; debe vivir en un componente
  `"use client"` (y `dynamic` si diera problemas de hidratación), nunca en el layout.
- **Descuento falso:** pintar el tachado sin comprobar `compareAtPriceCents >
  priceCents` muestra una oferta inexistente (002 §8.5). El guard va en el mapper.
