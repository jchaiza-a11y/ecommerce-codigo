---
id: 006
title: Ficha de producto /products/[slug]
status: done
module: storefront
scope: client
created: 2026-09-04
---

# 006 — Ficha de producto `/products/[slug]`

## Objetivo
Un visitante puede abrir la ficha de un producto desde el catálogo o la landing, ver su
detalle, añadirlo al carrito con la cantidad que elija y saltar a productos parecidos.

## Alcance
Incluye: ruta `/products/[slug]` (Server Component) · `findPublicBySlug` con las reglas
de visibilidad del catálogo · `generateMetadata` por producto (título, descripción,
`og:image`) · islote cliente de cantidad + añadir al carrito · **sección "Productos
parecidos" al pie** (`findSimilar`, heurística de misma categoría, ver Notas) ·
`not-found.tsx` y `loading.tsx` del segmento · tarjeta del grid enlazada a la ficha.

No incluye: **endpoint `/api/storefront/products/[slug]`** (ver Notas) · galería (un solo
`image_url`) · motor de recomendación, historial de navegación o "quien vio esto vio
aquello" (no hay eventos que registrar) · reseñas, valoraciones ni especificaciones (no
hay columnas) · checkout · favoritos · esquema · carrito ni catálogo de 005.

## Criterios de aceptación
- [ ] AC1 — Un visitante anónimo abre `/products/<slug>` de un producto activo y ve
      imagen, nombre, marca, categoría, precio y descripción, sin redirección a login.
- [ ] AC2 — Un slug inexistente, con `deleted_at`, `is_active = false` o de categoría
      inactiva responde `404` con la pantalla del segmento, nunca 500 ni ficha vacía.
- [ ] AC3 — Con `compare_at_price_cents` mayor que el precio se pinta badge de descuento
      y precio tachado, con la misma regla que `product-card` (mapper único).
- [x] AC4 — El selector va de 1 a 99. Si el producto **no** está en el carrito, "Añadir
      al carrito" suma esa cantidad exacta. Si **ya** está, el selector arranca mostrando
      la cantidad existente y el botón ("Actualizar carrito") la fija en vez de sumarla —
      evita que un click sin tocar el selector duplique sin querer lo que ya había. En
      ambos casos badge del header y subtotal del drawer cuadran, y tras `F5` el carrito
      sigue ahí.
- [ ] AC5 — Con `stock = 0` se ve "Sin stock", el botón queda deshabilitado y el selector
      de cantidad no se pinta.
- [ ] AC6 — `<title>` y `og:image` son los del producto, no los del layout; un slug
      inexistente no rompe `generateMetadata`.
- [ ] AC7 — Desde `/products` y la landing, pulsar imagen o nombre navega a la ficha; el
      botón `+` de la tarjeta sigue añadiendo al carrito **sin** navegar.
- [ ] AC8 — Si falla la carga del producto, la ficha pinta su estado de error (mismo tono
      que `/products`), diferenciado del 404.
- [ ] AC9 — Al pie se ven hasta 4 "Productos parecidos" de la **misma categoría**, nunca
      el actual, visibles según las reglas públicas, cada uno enlazado a su ficha.
- [ ] AC10 — Sin otros productos visibles en la categoría la sección no se pinta (ni
      bloque vacío ni "sin resultados"); si su consulta falla, la ficha se renderiza
      completa sin la sección — no cae en AC8.

## Datos
**Sin cambios de esquema.** No hay tabla `product_images` (una imagen grande, no galería)
ni relación producto↔producto: los similares salen de `category_id`, `brand` y
`price_cents`. Sin migración.

## API
**Sin endpoints nuevos.** Ficha y similares son lectura inicial con SEO: Server Component
→ repositorio directo (`docs/SETUP.md` §4, patrón de 004 §8.3). Sin Zod nuevo: el único
parámetro es el segmento `slug`, que se normaliza (`trim`, `toLowerCase`); si no hay fila,
`notFound()`.

## Reutilizar
- `src/server/repositories/product.repository.ts` — `publicWhere` (privada) es la fuente
  de visibilidad de `findPublicBySlug` y `findSimilar`. `findBySlug` **no** sirve (sin
  filtro `is_active`/categoría ni join): es del admin, no se toca.
- `src/modules/storefront/lib/to-storefront-product.ts` — mapper único, también para las
  tarjetas de similares. `schemas/catalog.schema.ts`: `StorefrontProduct` ya trae
  `description`, sin tipo nuevo.
- `src/modules/cart/store/cart.store.ts` — `addLine(snapshot, quantity)` ya hace `clamp`
  a 1–99. No tocar. `cart-drawer.tsx`: stepper (`Minus`/`Plus` + `aria-label`) a copiar,
  no a extraer — dos consumidores, aún no toca DRY.
- `src/modules/storefront/components/product-card.tsx` — se enlaza y se reutiliza tal cual
  en similares; no se crea tarjeta "compacta". `product-grid-skeleton.tsx` → loading.
- `src/modules/storefront/constants.ts` (`PRODUCT_IMAGE_FALLBACK`), `src/modules/products/constants.ts`
  (`formatPrice`), `src/components/ui/{button,badge,separator}`: **ningún `shadcn add`**.
- `src/proxy.ts` — `/products(.*)` ya es pública. No tocar.

## Tareas
- [x] T1 — `findPublicBySlug(slug): Promise<PublicProductRow | undefined>` — mismo join y
      `publicWhere({})` que `findPublic`, más `eq(product.slug, slug)` y `limit(1)`
      · `src/server/repositories/product.repository.ts`
- [x] T2 — `findSimilar(row: PublicProductRow, limit = 4): Promise<PublicProductRow[]>` —
      `publicWhere({})` + `eq(product.categoryId, row.categoryId)` + `ne(product.id, row.id)`,
      orden de la heurística (Notas), `limit` · `src/server/repositories/product.repository.ts`
- [x] T3 — `AddToCartForm` (`"use client"`): stepper 1–99 + botón que llama
      `addLine(snapshot, quantity)`; recibe `product: StorefrontProduct`
      · `src/modules/storefront/components/add-to-cart-form.tsx`
- [x] T4 — `ProductDetail` (server): imagen grande con `priority`, badges, marca, migas
      `Catálogo / <categoría>` → `/products?category=<slug>`, precios, descripción y
      `<AddToCartForm />` · `src/modules/storefront/components/product-detail.tsx`
- [x] T5 — `SimilarProducts` (server): recibe `products: StorefrontProduct[]`, devuelve
      `null` si viene vacío (AC10); si no, título + grid de `<ProductCard />` sin
      `priority` · `src/modules/storefront/components/similar-products.tsx`
- [x] T6 — Página: `revalidate = 60`, `generateMetadata`, carga por slug, `notFound()`,
      bloque de error de BD y `<SimilarProducts />` con su propio `try/catch`
      · `src/app/(storefront)/products/[slug]/page.tsx`
- [x] T7 — Pantalla 404 del segmento con CTA a `/products`
      · `src/app/(storefront)/products/[slug]/not-found.tsx`
- [x] T8 — Skeleton de la ficha + tira de similares con `ProductGridSkeleton`
      · `src/app/(storefront)/products/[slug]/loading.tsx`
- [x] T9 — Envolver imagen y `<h3>` en `<Link href={/products/${slug}}>` dejando el
      `<button>` `+` **fuera** del enlace, o el clic navega y añade a la vez (AC7)
      · `src/modules/storefront/components/product-card.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- **Similares = heurística simple, no recomendador.** Sin eventos ni tabla de relaciones,
  el único parecido disponible es el catálogo (como 004 §8.1: no inventar datos). Orden:
  misma marca primero (`case when brand = <marca> then 1 else 0 end desc`), luego menor
  distancia de precio (`abs(price_cents - <precio>) asc`), luego `created_at desc`. Con
  `brand = null` manda el precio. Si salen menos de 4 no se amplía a otras categorías.
- **Similares aislados** en su `try/catch`, devolviendo `[]` (AC10): un bloque secundario
  no convierte una ficha válida en error. Son 2 queries secuenciales por necesidad
  (`findSimilar` necesita `categoryId`), sin N+1 porque trae el join, y `revalidate = 60`
  las amortiza. Sin endpoint para ninguna: no tendrían consumidor (§6 DRY).
- **`notFound()` fuera del `try`.** Lanza internamente; dentro del `try/catch` del fallo
  de BD se volvería el error genérico (AC2 vs AC8): `try { row = await ... } catch {}` y
  se decide después. El `import` del repositorio va diferido dentro del `try`, como en
  `/products/page.tsx`, porque Drizzle lee `DATABASE_URL` al evaluar el módulo.
- **`params` es promesa (Next 16):** `PageProps<"/products/[slug]">` + `await params`,
  también en `generateMetadata`, que hace su **propia** consulta (sale del caché).
- **Sin mockup:** layout extrapolado de `product-card` y los tokens de `/products` — dos
  columnas en desktop (imagen `aspect-4/3` izquierda, compra derecha), una en móvil;
  similares en el grid del catálogo. No se inventan tokens.
