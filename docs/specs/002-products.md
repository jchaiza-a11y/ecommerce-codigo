---
id: 2
title: Productos — CRUD de administración (Fase 2)
status: done
module: products
scope: admin
created: 2026-08-28
---

# 002 — Productos — CRUD de administración (Fase 2)

## 1. Contexto

La Fase 1 (`001-categories.md`, done) dejó la taxonomía y toda la infraestructura
compartida: `DataTable` genérico sobre `@tanstack/react-table` v9, shell de admin,
y el patrón de módulo `src/modules/categories/`. El link "Productos" del sidebar
(`admin-sidebar.tsx:23`) ya apunta a `/admin/products`, hoy sin página.
Esta fase replica ese patrón sobre `products`, ahora con una FK a `categories`.

## 2. Objetivo

Un administrador puede crear, listar, filtrar, buscar, editar y eliminar productos
del catálogo desde `/admin/products`, con precios en centavos y categoría asignada.

## 3. Alcance

**Incluye:** tabla `products` + migración · repositorio · `GET/POST /api/products`
y `PATCH/DELETE /api/products/[id]` · módulo cliente `src/modules/products/` ·
página `/admin/products` con búsqueda global, filtros por estado y por categoría,
orden y paginación · selector de categoría alimentado por `useCategories` ·
**soft delete** de productos (`deleted_at`) · **precio de comparación tachado**
(`compare_at_price_cents`).

**No incluye:** vista de storefront · galería `product_images` · variantes
(color/talla/capacidad) · specs técnicas JSON · multi-moneda · impuestos ·
carga de archivos de imagen · RBAC (ver §11) · papelera, restauración o cualquier
UI/param para listar productos ya eliminados (ver §8.4).

## 4. Criterios de aceptación

- [ ] AC1 — Dado un admin en `/admin/products`, cuando la carga termina, entonces ve
      la tabla con nombre, SKU, categoría, precio formateado, stock, estado y fecha.
- [ ] AC2 — Dado el formulario de alta, cuando envía nombre + slug + SKU + precio +
      stock + categoría válidos, entonces el producto aparece en la tabla sin recargar.
- [ ] AC3 — Dado un slug o SKU ya existente **en un producto no eliminado**, cuando
      guarda, entonces recibe 409 y el error se marca sobre el campo culpable, con el
      diálogo abierto.
- [ ] AC4 — Dado un precio escrito como `1299.99`, cuando guarda, entonces se
      persiste `129999` en `price_cents` (entero) y se muestra `1.299,99 €`.
- [ ] AC5 — Dado un PATCH parcial (solo `stock`), cuando se aplica, entonces ningún
      otro campo cambia de valor.
- [ ] AC6 — Dado el filtro de categoría, cuando elige una, entonces la tabla muestra
      solo productos de esa categoría; "todos" la restaura.
- [ ] AC7 — Dada una categoría con productos asociados, cuando se intenta eliminar
      desde `/admin/categories`, entonces responde 409 con mensaje explicativo (no 500).
- [ ] AC8 — Estados de carga (skeleton), vacío y error visibles en la tabla.
- [ ] AC9 — Dado un producto eliminado desde el diálogo de borrado, cuando la tabla se
      refresca, entonces desaparece del listado y de `GET /api/products`, pero la fila
      sigue en la BD con `deleted_at` informado (verificable en `db:studio`).
- [ ] AC10 — Dado un producto eliminado, cuando se crea uno nuevo con **su mismo slug
      y SKU**, entonces se guarda con 201 (los únicos son parciales, §8.4).
- [ ] AC11 — Dado un producto con `compare_at_price_cents` informado, cuando se ve la
      celda de precio, entonces el precio de comparación aparece **tachado** junto al
      precio vigente; si es `null`, solo se muestra el precio vigente.

## 5. Modelo de datos — **A CONFIRMAR ANTES DE APROBAR**

Tabla `products` (`src/server/db/schema/product.ts`). Requiere migración
(`npm run db:generate && npm run db:migrate`).

| Columna | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` | igual que `categories` |
| `name` | `varchar(140)` | NOT NULL | |
| `slug` | `varchar(160)` | NOT NULL, **único parcial** | URL pública futura; ver §8.4 |
| `sku` | `varchar(40)` | NOT NULL, **único parcial** | referencia interna, mayúsculas |
| `description` | `text` | NULL | máx. 2000 en Zod |
| `brand` | `varchar(60)` | NULL | marca; útil para filtrar en tech |
| `price_cents` | `integer` | NOT NULL, `>= 0` | **centavos**, nunca float |
| `compare_at_price_cents` | `integer` | NULL, `>= 0` | precio tachado "antes"; ver §8.5 |
| `stock` | `integer` | NOT NULL, default `0`, `>= 0` | inventario simple |
| `category_id` | `uuid` | NOT NULL, FK → `categories.id` **ON DELETE RESTRICT** | ver §8.1 |
| `image_url` | `text` | NULL | **una** URL externa; sin subida de archivos |
| `is_active` | `boolean` | NOT NULL, default `true` | visible en catálogo |
| `created_at` | `timestamptz` | NOT NULL, `defaultNow()` | |
| `updated_at` | `timestamptz` | NOT NULL, `defaultNow()`, `$onUpdate` | |
| `deleted_at` | `timestamptz` | NULL | **soft delete**: `NULL` = vivo; ver §8.4 |

Índices:
- `products_slug_unique(slug) WHERE deleted_at IS NULL` — **único parcial**
- `products_sku_unique(sku) WHERE deleted_at IS NULL` — **único parcial**
- `products_category_idx(category_id)`
- `products_active_created_idx(is_active, created_at)`

En Drizzle: `uniqueIndex("products_slug_unique").on(t.slug).where(sql`${t.deletedAt} is null`)`.
Decisión y motivo en §8.4. `deleted_at` no lleva índice propio: el volumen de
productos de esta fase no lo justifica y el filtro va siempre acompañado de otros.

**Puntos que el usuario debe confirmar, agregar o quitar al aprobar:**
1. `brand` — se propone incluirla; se puede quitar sin afectar al resto.
2. `image_url` — una sola URL de texto. Alternativa: diferirla entera a la spec de
   `product_images`. Se propone incluirla por utilidad inmediata.
3. `stock` como entero plano (sin reservas ni umbral de stock bajo).
4. Moneda implícita **EUR** con formato `es-ES` (sin columna `currency`).
5. `sku` obligatorio y único (alternativa: opcional y nullable).
6. `compare_at_price_cents` sin validación estricta contra `price_cents` (§8.5).

## 6. Contratos de API

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/products` | pública (§11) | — | `200 ProductListItem[]` · `500` |
| POST | `/api/products` | pública (§11) | `createProductSchema` | `201 Product` · `400` · `409` · `500` |
| PATCH | `/api/products/[id]` | pública (§11) | `updateProductSchema` | `200 Product` · `400` · `404` · `409` · `500` |
| DELETE | `/api/products/[id]` | pública (§11) | — | `204` · `400` · `404` · `500` |

`ProductListItem = Product & { categoryName: string }` (join en el repositorio;
evita una segunda petición y el N+1 por fila).
Conflictos 409: `"Ya existe un producto con ese slug"` / `"…con ese SKU"`.
`category_id` inexistente → `400 "La categoría seleccionada no existe"`.

**Soft delete en la API:**
- `DELETE /api/products/[id]` **no borra la fila**: ejecuta
  `UPDATE products SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`.
  Si no afecta filas (inexistente o ya eliminado) → `404`. Respuesta sigue siendo `204`.
- `GET /api/products` devuelve **solo** filas con `deleted_at IS NULL`. No se añade
  query param `includeDeleted`: sin pantalla que lo consuma sería superficie muerta;
  se difiere a la spec de papelera/restauración (§8.4).
- `PATCH` y `GET`/`findById` operan solo sobre filas vivas: un producto eliminado
  responde `404`.

**Zod** (`src/modules/products/schemas/product.schema.ts`):
- `productFields` — base **sin `.default()`** (lección de Fase 1): `name`, `slug`
  (`SLUG_PATTERN`), `sku`, `description`, `brand`, `priceCents`,
  `compareAtPriceCents` (`z.int().min(0).nullish()`), `stock`,
  `categoryId` (`z.uuid()`), `imageUrl` (`z.url().nullish()`), `isActive`.
- `createProductSchema` — `productFields` + `.default()` solo en `isActive` (true),
  `stock` (0). `updateProductSchema` — `.partial()` sobre la base + `refine` no vacío.
- `productIdSchema` — `z.uuid()`.
- **Sin `.refine()` cruzado** `compareAtPriceCents > priceCents`: ver §8.5.
- `deletedAt` **no** aparece en ningún schema de entrada: lo gestiona el repositorio.

## 7. Reutilizar (verificado)

- `src/components/shared/data-table.tsx` — `DataTable` + `DataTableFeatures` + `DataTableFilter`, tal cual.
- `src/modules/categories/hooks/use-categories.ts` — poblar el `Select` de categoría.
- `src/lib/axios.ts` (`api`) · `src/components/providers/query-provider.tsx`.
- Patrón exacto a copiar, archivo por archivo: `category.repository.ts`,
  `app/api/categories/route.ts` + `[id]/route.ts`, `category.service.ts`
  (`getApiErrorMessage`, `isConflictError` — **replicar en `product.service.ts`**,
  no importar cruzado), `category-columns.tsx`, `category-form-dialog.tsx`
  (`field` + RHF + `zodResolver` + `Controller`), `delete-category-dialog.tsx`,
  `categories-table.tsx`, `use-category-mutations.ts`.
  Ojo: `category.repository.ts` borra físicamente (`db.delete`); `product.repository.ts`
  **no** copia ese `remove` — ver T3.
- shadcn: `badge`, `button`, `dialog`, `alert-dialog`, `dropdown-menu`, `field`,
  `input`, `select`, `switch`, `textarea`, `table`, `skeleton`, `sonner` ya instalados.
  **Nada nuevo que instalar.**

## 8. Decisiones técnicas

**8.1 `ON DELETE RESTRICT`.** `category_id` es NOT NULL (un producto siempre
pertenece a una categoría), así que `SET NULL` obligaría a hacerla nullable y a
tolerar productos huérfanos invisibles en el catálogo. RESTRICT protege la
integridad y fuerza al admin a reasignar o desactivar antes de borrar. Consecuencia
obligatoria: `DELETE /api/categories/[id]` debe traducir la violación FK de
Postgres (`23503`) a **409** con mensaje claro; hoy la dejaría escapar como 500 (T9).
Nota: con soft delete, un producto "eliminado" **sigue reteniendo la FK**, así que
seguirá bloqueando el borrado de su categoría (§10).

**8.2 Precio.** La BD guarda enteros. El formulario acepta unidades con 2 decimales
y convierte con `Math.round(value * 100)`; al editar, `priceCents / 100`. Formato de
salida con `Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })`,
instanciado a nivel de módulo (igual que `dateFormatter` en `category-columns.tsx`).
Aplica igual a `compareAtPriceCents`.

**8.3 Filtro por categoría.** Columna `categoryName` con `filterFn` por igualdad
exacta y `options` derivadas de `useCategories`; mismo mecanismo que el filtro de
estado de Fase 1 (el `Select` entrega strings).

**8.4 Soft delete solo en `products`.** Un producto es referenciado por datos que
sobreviven a su retirada del catálogo: líneas de pedido, carritos e histórico de
precios (fases siguientes). Borrarlo físicamente rompería esas referencias o
forzaría a duplicar el nombre/precio en cada pedido. `categories` **no** tiene esa
dependencia (sus consumidores son productos vivos, protegidos por RESTRICT), así que
mantiene su borrado físico: la divergencia es deliberada, no una inconsistencia.

Los índices únicos de `slug` y `sku` son **parciales** (`WHERE deleted_at IS NULL`).
Con un único total, un producto eliminado retendría su slug y su SKU para siempre y
el admin no podría reutilizarlos ni recrear el producto — un bug reportable desde el
día uno. Consecuencia: toda verificación de unicidad (repositorio y traducción del
`23505`) debe mirar **solo filas vivas**, o el 409 se emitiría contra un producto que
el usuario ya no ve.

Sin papelera ni restauración en esta fase: no hay pantalla que las consuma. Cuando
se necesiten, entran con su propia spec (endpoint de restore + vista filtrada).

**8.5 `compare_at_price_cents`.** Nullable: la mayoría de productos no está en
oferta. Semántica: si está informado, representa el precio anterior tachado, por lo
que **debería** ser `> price_cents`. Esa comparación **no** se valida con `.refine()`
en Zod en esta fase, por dos razones: (a) `updateProductSchema` es `.partial()`, así
que un PATCH de solo `compareAtPriceCents` no tiene `priceCents` en el payload y el
refine no podría decidir sin leer la fila actual — lógica de servicio, no de schema;
(b) forzarlo bloquearía usos legítimos de carga de datos. Zod valida solo
`int >= 0 | null`. La coherencia se comunica en la UI: el formulario muestra un
texto de ayuda ("debe ser mayor que el precio de venta") y la celda de precio
**no pinta el tachado** si `compareAtPriceCents <= priceCents`. Queda anotado como
riesgo (§10) y candidato a validación estricta en la fase de storefront/promociones.

## 9. Tareas

- [x] T1 — Tabla Drizzle (incluye `compare_at_price_cents` y `deleted_at`) + únicos **parciales** de `slug`/`sku` + tipos inferidos · `src/server/db/schema/product.ts` (+ barrel `index.ts`)
- [x] T2 — Generar y aplicar migración · `npm run db:generate && npm run db:migrate`
- [x] T3 — Repositorio con soft delete · `src/server/repositories/product.repository.ts`
      — `findAll` (join a categoría), `findById`, `findBySlug`, `findBySku`: todos con
      `isNull(product.deletedAt)` en el `where`, incluidas las llamadas de verificación
      de unicidad de `create`/`update` (solo filas vivas, §8.4)
      — `create`, `update` (update también acotado a filas vivas), `isForeignKeyViolation`
- [x] T3b — `remove(id)` = `update` de `deleted_at` a `now()` acotado con `isNull(deletedAt)`; devuelve `undefined` si no afectó filas (→ 404) · mismo archivo
- [x] T4 — Schemas Zod, con `compareAtPriceCents` opcional/nullable **sin `.refine()` cruzado** (§8.5) · `src/modules/products/schemas/product.schema.ts`
- [x] T5 — `productKeys`, opciones de estado, formateador de moneda · `src/modules/products/constants.ts`
- [x] T6 — Reexport de tipos (`import type`) · `src/modules/products/types/product.types.ts`
- [x] T7 — `GET` + `POST` · `src/app/api/products/route.ts`
- [x] T8 — `PATCH` + `DELETE` (DELETE llama al `remove` de soft delete; `undefined` → 404, éxito → 204) · `src/app/api/products/[id]/route.ts`
- [x] T9 — FK `23503` → 409 en borrado de categoría · `src/app/api/categories/[id]/route.ts` (+ helper en `category.repository.ts`)
- [x] T10 — Service axios · `src/modules/products/services/product.service.ts`
- [x] T11 — Hook de lectura · `src/modules/products/hooks/use-products.ts`
- [x] T12 — Hooks de mutación con invalidación y toasts · `src/modules/products/hooks/use-product-mutations.ts`
- [x] T13 — Columnas; la celda de precio muestra `compareAtPriceCents` tachado (`line-through`, `text-muted-foreground`) sobre el precio vigente, solo cuando existe y es `> priceCents` · `src/modules/products/components/product-columns.tsx`
- [x] T14 — Diálogo de formulario (alta/edición, slug automático, precio y precio de comparación en unidades, campo opcional con texto de ayuda; vacío → `null`) · `src/modules/products/components/product-form-dialog.tsx`
- [x] T15 — Diálogo de borrado (texto: el producto deja de estar disponible; sin mencionar borrado definitivo) · `src/modules/products/components/delete-product-dialog.tsx`
- [x] T16 — Tabla orquestadora con filtros de estado y categoría · `src/modules/products/components/products-table.tsx`
- [x] T17 — Página de admin · `src/app/(admin)/admin/products/page.tsx`
- [x] T18 — Excepción temporal de auth (solo si el usuario la confirma, §11) · `src/proxy.ts`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer).

## 10. Riesgos

- **Precio en float:** `1299.99 * 100 = 129998.99…`. `Math.round` es obligatorio;
  cualquier `parseFloat` sin redondeo es hallazgo bloqueante.
- **Doble unicidad:** slug y SKU son dos índices únicos distintos; el 409 debe
  identificar cuál chocó (verificación previa + `constraint` del error 23505).
- **Único no parcial:** si T1 declara `uniqueIndex(...)` sin `.where(deletedAt is null)`,
  un producto eliminado bloquea su slug y su SKU para siempre y no hay forma de
  recrearlo. Simétrico: si el índice es parcial pero `findBySlug`/`findBySku` **no**
  filtran `deleted_at IS NULL`, la API devolvería 409 contra un producto invisible.
  Ambos lados deben cambiar juntos.
- **`compare_at_price_cents <= price_cents`:** no se valida (§8.5), así que la BD
  admite un "descuento" que sube el precio. Mitigación en UI: no se pinta el tachado
  si no es mayor. Si en storefront se pinta sin ese guard, se muestra una oferta falsa.
- **Categoría bloqueada por productos eliminados:** un producto con `deleted_at`
  conserva su FK y sigue disparando el 409 de T9; para el admin la categoría parece
  vacía pero no se deja borrar. Aceptado en esta fase; el mensaje del 409 no debe
  prometer que basta con vaciar la tabla visible.
- **`.default()` en `.partial()`:** repetir el patrón de `category.schema.ts`;
  si no, un PATCH de solo `stock` resetearía `isActive` a `true` en silencio.
- **Referencia estable:** `data ?? EMPTY_PRODUCTS` con constante a nivel de módulo;
  un array nuevo por render invalida los row models de TanStack Table.

## 11. Deuda aceptada — RESUELTA por `003-roles-permisos.md`

> **Estado: resuelta.** La Fase 3 (spec 003) eliminó `isTemporarilyPublicAdminRoute`
> y los `TODO(001)`/`TODO(002)` de `src/proxy.ts`: `/admin/products` y
> `/admin/categories` exigen ahora `products.view` / `categories.view`, y las
> mutaciones de `/api/products` y `/api/categories` verifican
> `requirePermission('<recurso>.<acción>')` dentro de su Route Handler
> (003 §8.8, T26–T28). Lo que sigue queda como registro histórico.


Fase 1 se entregó **sin autenticación**, con una excepción explícita en
`src/proxy.ts` (`isTemporarilyPublicAdminRoute` = `/admin/categories(.*)`, evaluada
antes de `isAdminRoute`, marcada `TODO(001)`). `/api/products(.*)` ya figura como
ruta pública en `isPublicRoute`.

**Propuesta a confirmar:** extender esa misma excepción a `/admin/products(.*)`
con un `TODO(002)`, manteniendo la coherencia con categorías hasta que exista la
spec de auth/RBAC. **No se asume aprobada:** si el usuario prefiere que
`/admin/products` quede ya protegido por Clerk, se elimina T18 y la página hereda
`auth.protect()` de `isAdminRoute` (el resto de la spec no cambia).

No existe todavía infraestructura de roles/permisos, por lo que
`requirePermission('products.create')` (CLAUDE.md §4.8) y el registro en
`audit_logs` quedan fuera de alcance y se incorporarán en la spec de RBAC.
