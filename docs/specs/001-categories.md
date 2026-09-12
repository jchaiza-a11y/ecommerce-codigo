---
id: 1
title: Categorías de productos — CRUD de administración (Fase 1)
status: done
module: products
scope: admin
created: 2026-08-28
---

# 001 — Categorías de productos — CRUD de administración (Fase 1)

## 1. Contexto

El catálogo necesita una taxonomía antes de poder cargar productos: `docs/SETUP.md`
§5.3 define `categories` como tabla 1—N sobre `products`. Hoy el proyecto es un
scaffold: `src/server/db/schema/index.ts` es un barrel vacío (`export {}`),
`src/server/repositories/` y `src/server/services/` están vacíos, `drizzle/` no
tiene migraciones y los ocho módulos de `src/modules/` son solo carpetas vacías.

Categorías es además la **primera sección de administración** del proyecto. No
existe `src/app/(admin)/admin/layout.tsx`, `src/components/shared/` está vacía y
no hay ningún uso previo de `@tanstack/react-table`. Por eso esta feature carga
también con el andamiaje admin que la Fase 2 (productos) reutilizará: layout con
sidebar y un `DataTable` compartido.

## 2. Objetivo

Un administrador puede crear, listar, buscar, filtrar, editar y eliminar
categorías desde `/admin/categories`, persistidas en Neon, para poder clasificar
productos en la Fase 2.

## 3. Alcance

### Incluye

- Tabla `categories` en Neon vía Drizzle + migración generada y aplicada.
- Repositorio `category.repository.ts` con las cinco operaciones de datos.
- Route Handlers `GET`/`POST /api/categories` y `PATCH`/`DELETE /api/categories/[id]`, validados con Zod.
- Layout de administración `src/app/(admin)/admin/layout.tsx` con sidebar de navegación (sin guard de auth).
- Componente compartido `src/components/shared/data-table.tsx` sobre `@tanstack/react-table` **v9**, reutilizable, con buscador global, filtros por columna, orden y paginación.
- Módulo cliente `src/modules/categories/` completo: schemas Zod, tipos inferidos, service axios, hooks TanStack Query, columnas, tabla, diálogo de alta/edición y confirmación de borrado.
- Página `src/app/(admin)/admin/categories/page.tsx`.
- Excepción temporal en `src/proxy.ts` para dejar `/admin/categories` accesible sin sesión (ver §11).

### No incluye (explícito)

- Autenticación, RBAC y `requirePermission` — decisión cerrada con el usuario para esta fase (§11).
- Escritura en `audit_logs` (la tabla no existe todavía).
- Jerarquía padre/hijo de categorías (lista plana en esta fase).
- Imagen o ícono de categoría (no hay storage de blobs configurado).
- Vista de categorías en el storefront (`(storefront)`), y cualquier relación con `products`.
- Paginación y filtrado en servidor (se filtra en cliente sobre el listado completo, §8).
- Reordenamiento drag & drop de `sort_order` (se edita como número en el formulario).
- Seed de categorías (`src/server/db/seed.ts` no existe).

## 4. Criterios de aceptación

- [x] **AC1** — Dado un administrador en `/admin/categories`, cuando la página carga, entonces ve la tabla de categorías con columnas Nombre, Slug, Orden, Estado y Creada, con estado de carga (skeleton) mientras la consulta resuelve y un mensaje de error si falla.
- [x] **AC2** — Dado que no existe ninguna categoría, cuando la lista resuelve vacía, entonces se muestra un estado vacío en español con acción "Nueva categoría".
- [x] **AC3** — Dado el diálogo de creación, cuando envío nombre `"Laptops"` con los demás campos válidos, entonces se crea la categoría con slug `laptops`, la tabla se refresca sin recargar la página y aparece un toast de éxito.
- [x] **AC4** — Dado el diálogo de creación, cuando envío un nombre vacío o de más de 80 caracteres, entonces el formulario muestra el error de validación en español y no se dispara ninguna petición HTTP.
- [x] **AC5** — Dado que ya existe una categoría con slug `laptops`, cuando intento crear u editar otra con el mismo slug, entonces la API responde `409` y la UI muestra "Ya existe una categoría con ese slug" sin cerrar el diálogo.
- [x] **AC6** — Dada una fila de la tabla, cuando abro su menú de acciones y elijo "Editar", entonces el diálogo abre precargado con los valores actuales y al guardar solo se envían los campos modificados.
- [x] **AC7** — Dada una fila, cuando elijo "Eliminar" y confirmo en el diálogo de confirmación, entonces la categoría desaparece de la tabla y la API responde `204`; si cancelo, no se envía nada.
- [x] **AC8** — Dado un listado con varias categorías, cuando escribo en el buscador, entonces la tabla filtra por nombre y slug en cliente; cuando uso el filtro de estado, entonces solo se muestran las activas o las inactivas según la selección.
- [x] **AC9** — Dado `PATCH /api/categories/:id` con un `id` que no es UUID, entonces responde `400`; con un UUID inexistente, responde `404`.
- [x] **AC10** — Dado el proyecto completo, cuando ejecuto `npm run typecheck && npm run lint && npm run build`, entonces los tres terminan en verde.

## 5. Modelo de datos

Tabla nueva `categories`. **Requiere migración** (`npm run db:generate` +
`npm run db:migrate`); `drizzle/` está vacío, así que esta será la migración
`0000`. `drizzle.config.ts` ya apunta a `./src/server/db/schema`.

| Columna | Tipo | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` |
| `name` | `varchar(80)` | `not null` |
| `slug` | `varchar(100)` | `not null`, único |
| `description` | `text` | nullable |
| `is_active` | `boolean` | `not null`, default `true` |
| `sort_order` | `integer` | `not null`, default `0` |
| `created_at` | `timestamptz` | `not null`, default `now()` |
| `updated_at` | `timestamptz` | `not null`, default `now()`, `$onUpdate` |

Índices: `categories_slug_unique` (unique sobre `slug`),
`categories_active_sort_idx` sobre (`is_active`, `sort_order`).

Sin claves foráneas en esta fase: `products` aún no existe.

```ts
// src/server/db/schema/category.ts — firma propuesta
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

export const category = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("categories_slug_unique").on(t.slug),
    index("categories_active_sort_idx").on(t.isActive, t.sortOrder),
  ],
);

export type Category = InferSelectModel<typeof category>;
export type NewCategory = InferInsertModel<typeof category>;
```

`src/server/db/schema/index.ts` deja de ser `export {}` y pasa a
`export * from "./category";` (lo consume `drizzle({ client: sql, schema })` en
`src/server/db/index.ts`).

## 6. Contratos de API

Todos los endpoints viven bajo `/api/categories`, que `src/proxy.ts` ya declara
público en `isPublicRoute`. **No** se usa `/api/admin/*` porque ese prefijo está
bajo `auth.protect()` y esta fase es sin autenticación (§11).

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/categories` | público (Fase 1) | — | `200 Category[]` | 500 |
| POST | `/api/categories` | público (Fase 1) | `CreateCategoryInput` | `201 Category` | 400, 409, 500 |
| PATCH | `/api/categories/[id]` | público (Fase 1) | `UpdateCategoryInput` | `200 Category` | 400, 404, 409, 500 |
| DELETE | `/api/categories/[id]` | público (Fase 1) | — | `204` sin cuerpo | 400, 404, 500 |

`GET` devuelve el listado completo ordenado por `sortOrder` asc, `name` asc. Sin
paginación ni filtros de servidor en esta fase (§8, D3).

Cuerpo de error uniforme: `{ error: string, issues?: z.core.$ZodIssue[] }`.
`issues` solo se envía en 400 de validación.

Schemas Zod (Zod 4 instalado — formatos de string en el nivel superior:
`z.uuid()`, no `z.string().uuid()`):

```ts
// src/modules/categories/schemas/category.schema.ts — firma propuesta
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80, "Máximo 80 caracteres"),
  slug: z.string().trim().min(1, "El slug es obligatorio").max(100, "Máximo 100 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0, "Debe ser 0 o mayor").default(0),
});

export const updateCategorySchema = createCategorySchema.partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios que guardar");

export const categoryIdSchema = z.uuid("Identificador inválido");

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

Salida: no se declara un schema Zod de respuesta. El tipo de salida es
`Category` inferido del schema Drizzle (`docs/SETUP.md` §4, regla 5: los tipos se
infieren, no se duplican).

## 7. Arquitectura y archivos afectados

- `src/server/db/schema/category.ts` — **nuevo**. Tabla `categories` + tipos inferidos.
- `src/server/db/schema/index.ts` — **modificado**. Barrel: reexporta `./category`.
- `drizzle/0000_*.sql` + `drizzle/meta/` — **generado** por `db:generate`.
- `src/server/repositories/category.repository.ts` — **nuevo**. `findAll`, `findById`, `findBySlug`, `create`, `update`, `remove`. Única capa que toca Drizzle.
- `src/app/api/categories/route.ts` — **nuevo**. `GET` (listar), `POST` (crear).
- `src/app/api/categories/[id]/route.ts` — **nuevo**. `PATCH`, `DELETE`.
- `src/proxy.ts` — **modificado**. Excepción temporal para `/admin/categories(.*)`.
- `src/components/shared/admin-sidebar.tsx` — **nuevo**. Navegación admin (client, usa `usePathname`).
- `src/app/(admin)/admin/layout.tsx` — **nuevo**. Shell: sidebar + área de contenido. Server Component.
- `src/components/shared/data-table.tsx` — **nuevo**. `DataTable` genérico sobre react-table v9 + `Table` de shadcn.
- `src/modules/categories/constants.ts` — **nuevo**. `categoryKeys` (query keys) y opciones del filtro de estado.
- `src/modules/categories/schemas/category.schema.ts` — **nuevo**. Zod de entrada.
- `src/modules/categories/types/category.types.ts` — **nuevo**. Reexporta `Category` con `import type` desde el schema Drizzle.
- `src/modules/categories/services/category.service.ts` — **nuevo**. Axios tipado sobre `@/lib/axios`.
- `src/modules/categories/hooks/use-categories.ts` — **nuevo**. `useQuery`.
- `src/modules/categories/hooks/use-category-mutations.ts` — **nuevo**. `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`.
- `src/modules/categories/components/category-columns.tsx` — **nuevo**. Definición de columnas + menú de acciones.
- `src/modules/categories/components/category-form-dialog.tsx` — **nuevo**. Alta y edición (RHF + `field` + `zodResolver`).
- `src/modules/categories/components/delete-category-dialog.tsx` — **nuevo**. Confirmación destructiva.
- `src/modules/categories/components/categories-table.tsx` — **nuevo**. Client Component que orquesta hooks + `DataTable` + diálogos.
- `src/app/(admin)/admin/categories/page.tsx` — **nuevo**. Server Component: título, descripción y `<CategoriesTable />`.
- `src/components/ui/alert-dialog.tsx`, `switch.tsx`, `textarea.tsx` — **generados** por `npx shadcn@latest add`.

Sin cambios en `src/server/services/`: no hay regla de negocio que cruce
repositorios en esta fase.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D1.** `DataTable` con `useTable` + `tableFeatures()` y slots de row model (`createFilteredRowModel`, `createSortedRowModel`, `createPaginatedRowModel`) | `useReactTable` + `getCoreRowModel()` como documenta `SETUP.md` §1 | La versión instalada es `@tanstack/react-table` **9.2.3**, no v8. En v9 `useReactTable` y las opciones `get*RowModel` no existen; las features se registran explícitamente. Fundado en las skills empaquetadas del propio paquete: `node_modules/@tanstack/react-table/skills/getting-started/SKILL.md` y `migrate-v8-to-v9/SKILL.md`. `SETUP.md` §1 queda desactualizado en esa fila. |
| **D2.** `DataTable` exporta su `const dataTableFeatures` y los módulos tipan columnas con `createColumnHelper<typeof dataTableFeatures, T>()` | Tipar columnas con `ColumnDef<T>[]` suelto | En v9 el helper de columnas es genérico sobre el set de features del table; sin compartir `typeof features` las columnas no tipan contra el `useTable` interno del `DataTable`. |
| **D3.** Filtrado, búsqueda, orden y paginación en **cliente**, sobre el listado completo | Paginación y `?search=` en servidor | El volumen esperado de categorías es de decenas. Servidor añadiría contrato, índices y estado sincronizado sin beneficio medible. Productos (Fase 2) sí requerirá servidor; el `DataTable` acepta `data` ya resuelta, así que la migración es aditiva. |
| **D4.** Formularios con el primitivo `field` de shadcn + wiring manual de RHF | `npx shadcn@latest add form` (wrapper `<Form>`) | `field` ya está instalado y es el patrón vigente del proyecto (memoria de proyecto: este repo usa `field`, no el wrapper `Form`). Evita dos APIs de formulario conviviendo. |
| **D5.** Todo el CRUD bajo `/api/categories`, no `/api/admin/categories` | Endpoints admin bajo `/api/admin/` según `SETUP.md` §3 | `src/proxy.ts` aplica `await auth.protect()` a `/api/admin(.*)`. En una fase sin autenticación esos endpoints serían inalcanzables. `/api/categories` ya figura en `isPublicRoute` y coincide con el árbol de `SETUP.md` §3. |
| **D6.** Excepción acotada en `proxy.ts` para `/admin/categories(.*)`, evaluada **antes** de `isAdminRoute` | Abrir todo `/admin(.*)`; o dejar el guard y firmar sesión | `isAdminRoute` se evalúa primero en el handler actual y llama `auth.protect()`, así que la página redirigiría a sign-in. Abrir solo la subruta de categorías mantiene protegido el resto del panel cuando se agregue. Va con comentario `TODO(001)` y se revierte en el spec de auth. |
| **D7.** Slug editable, autogenerado desde el nombre solo mientras se crea | Slug derivado siempre del nombre en servidor | El slug es parte de la URL pública futura; renombrar una categoría no debe cambiar su URL en silencio. Unicidad garantizada por índice único + verificación en repositorio → `409`. |
| **D8.** Borrado físico (`DELETE` real) | Borrado lógico con `deleted_at` | No hay `products` ni `audit_logs` que referencien la fila todavía; una columna de soft delete sin consumidor sería complejidad muerta (CLAUDE.md §6: nada de abstracciones sin consumidor). `is_active` cubre "ocultar sin borrar". Reevaluar al crear la FK en Fase 2 (§10). |
| **D9.** `id` `uuid` con `defaultRandom()` | `serial` autoincremental | Coherente con `audit_logs.id uuid` de `SETUP.md` §5.2 y no filtra volumen de negocio en URLs. |
| **D10.** Handlers tipados con los helpers globales de Next 16 (`RouteContext<'/api/categories/[id]'>`), `await params` | Firma manual `{ params: { id: string } }` | Los helpers tipados están activos en este proyecto (`src/app/layout.tsx` ya usa `LayoutProps<"/">`). En Next 16 `params` es una `Promise` y debe await-earse. |
| **D11.** Query keys centralizadas en `src/modules/categories/constants.ts` | Arrays literales en cada hook | Invalidación consistente entre los tres mutation hooks; un solo punto de cambio. |

## 9. Tareas

- [x] **T1** — Instalar los componentes shadcn faltantes: `npx shadcn@latest add alert-dialog switch textarea` · archivos: `src/components/ui/{alert-dialog,switch,textarea}.tsx` · verificación: los tres archivos existen y `npm run typecheck` pasa.
- [x] **T2** — Crear el schema Drizzle de `categories` según §5 (tabla, índices, tipos `Category`/`NewCategory` inferidos) · archivo: `src/server/db/schema/category.ts` · verificación: `npm run typecheck`.
- [x] **T3** — Reexportar el schema en el barrel (reemplaza `export {}`) · archivo: `src/server/db/schema/index.ts` · verificación: `npm run typecheck`.
- [x] **T4** — Generar y aplicar la migración · comandos: `npm run db:generate` y `npm run db:migrate` · archivos: `drizzle/0000_*.sql`, `drizzle/meta/*` · verificación: `npm run db:studio` muestra la tabla `categories` vacía con las 8 columnas.
- [x] **T5** — Repositorio con `findAll` (orden `sortOrder` asc, `name` asc), `findById`, `findBySlug` (con `excludeId` opcional para el caso de edición), `create`, `update`, `remove` (devuelve el registro borrado o `undefined`) · archivo: `src/server/repositories/category.repository.ts` · verificación: `npm run typecheck`.
- [x] **T6** — Schemas Zod de entrada y tipos de input según §6 · archivo: `src/modules/categories/schemas/category.schema.ts` · verificación: `npm run typecheck`.
- [x] **T7** — Tipos del módulo: reexportar `Category` con `import type` desde `@/server/db/schema/category` (import de tipo, se borra en compilación; no arrastra `db` al bundle) · archivo: `src/modules/categories/types/category.types.ts` · verificación: `npm run typecheck`.
- [x] **T8** — Route Handler `GET` (listar) y `POST` (validar con `createCategorySchema`, 409 si el slug existe, 201 con la fila creada) · archivo: `src/app/api/categories/route.ts` · verificación: `npm run typecheck`; `curl` a `GET /api/categories` devuelve `[]`.
- [x] **T9** — Route Handler `PATCH` y `DELETE` con validación de `id` (`categoryIdSchema`), 404 si no existe, 409 por slug duplicado, 204 sin cuerpo en borrado · archivo: `src/app/api/categories/[id]/route.ts` · verificación: `npm run typecheck`; `PATCH` con id no-UUID devuelve 400.
- [x] **T10** — Excepción temporal de auth: matcher `/admin/categories(.*)` evaluado antes de `isAdminRoute`, con comentario `TODO(001): revertir en el spec de auth/RBAC` · archivo: `src/proxy.ts` · verificación: en `npm run dev`, `/admin/categories` responde sin redirigir a `/sign-in`.
- [x] **T11** — Sidebar de administración: enlaces a Dashboard, Productos, Categorías, Pedidos, Clientes; ítem activo resaltado con `usePathname`; textos en español · archivo: `src/components/shared/admin-sidebar.tsx` · verificación: `npm run typecheck`.
- [x] **T12** — Layout de administración (Server Component, sin `"use client"`, sin guard de auth): sidebar + `<main>` para el contenido, tipado con `LayoutProps<"/admin">` · archivo: `src/app/(admin)/admin/layout.tsx` · verificación: `npm run build`.
- [x] **T13** — `DataTable` genérico y reutilizable con react-table v9 según D1/D2: exporta `dataTableFeatures`, recibe `columns`, `data`, `isLoading`, `searchPlaceholder`, `filters` (id de columna + opciones) y `emptyMessage`; renderiza buscador global, selects de filtro, encabezados ordenables, `Table` de shadcn, `Skeleton` en carga, estado vacío y controles de paginación · archivo: `src/components/shared/data-table.tsx` · verificación: `npm run typecheck` y `npm run lint`.
- [x] **T14** — Constantes del módulo: `categoryKeys` (`all`, `lists()`) y `CATEGORY_STATUS_OPTIONS` para el filtro · archivo: `src/modules/categories/constants.ts` · verificación: `npm run typecheck`.
- [x] **T15** — Service axios tipado: `getCategories`, `createCategory`, `updateCategory`, `deleteCategory` sobre `api` de `@/lib/axios`; sin `try/catch` que silencie errores · archivo: `src/modules/categories/services/category.service.ts` · verificación: `npm run typecheck`.
- [x] **T16** — Hook de lectura `useCategories()` (`useQuery`, key de `categoryKeys.lists()`) · archivo: `src/modules/categories/hooks/use-categories.ts` · verificación: `npm run typecheck`.
- [x] **T17** — Hooks de mutación `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` con invalidación de `categoryKeys.all` y toast de éxito/error en español · archivo: `src/modules/categories/hooks/use-category-mutations.ts` · verificación: `npm run typecheck`.
- [x] **T18** — Columnas de la tabla: Nombre, Slug, Orden, Estado (`Badge` Activa/Inactiva), Creada (fecha `es-ES`) y columna de acciones (`DropdownMenu`: Editar, Eliminar) construidas con `createColumnHelper<typeof dataTableFeatures, Category>()` · archivo: `src/modules/categories/components/category-columns.tsx` · verificación: `npm run typecheck`.
- [x] **T19** — Diálogo de alta/edición: RHF + `zodResolver` + primitivo `field`; campos nombre, slug (autogenerado desde el nombre solo en modo alta), descripción (`Textarea`), estado (`Switch`), orden (`Input type="number"`); botón deshabilitado mientras `isPending`; mapea 409 al campo `slug` · archivo: `src/modules/categories/components/category-form-dialog.tsx` · verificación: `npm run typecheck` y `npm run lint`.
- [x] **T20** — Diálogo de confirmación de borrado con `AlertDialog`, nombre de la categoría en el mensaje y acción destructiva · archivo: `src/modules/categories/components/delete-category-dialog.tsx` · verificación: `npm run typecheck`.
- [x] **T21** — Componente cliente `CategoriesTable`: consume `useCategories`, pasa datos y columnas al `DataTable`, gestiona el estado local de los diálogos (alta/edición/borrado), botón "Nueva categoría" y render de error de la query · archivo: `src/modules/categories/components/categories-table.tsx` · verificación: `npm run typecheck`.
- [x] **T22** — Página de administración (Server Component): encabezado en español y `<CategoriesTable />` · archivo: `src/app/(admin)/admin/categories/page.tsx` · verificación: `npm run build`.
- [x] **T23** — Verificación final del flujo completo en `npm run dev`: crear, editar, buscar, filtrar y eliminar una categoría contra Neon · verificación: `npm run typecheck && npm run lint && npm run build` en verde y AC1–AC10 comprobados uno por uno.

## 10. Riesgos y consideraciones

- **Superficie sin autenticación.** Con T10, `/admin/categories` y los cuatro endpoints de `/api/categories` quedan escribibles por cualquiera que alcance el servidor. Aceptable **solo** en desarrollo local. No desplegar esta fase a un entorno público antes del spec de auth. Es la mitigación explícita de la excepción a la regla dura CLAUDE.md §4.8.
- **Regresión de seguridad al revertir.** Al cerrar el spec de auth hay que quitar el matcher de T10 y mover el CRUD a `/api/admin/categories` con `requirePermission('categories.*')`. Si el matcher queda olvidado, el panel entero queda abierto: por eso la excepción es una sola línea con `TODO(001)` y no un cambio disperso.
- **Carrera en la unicidad de slug.** `findBySlug` + `insert` no es atómico. Dos altas simultáneas con el mismo slug pueden pasar la verificación y chocar contra el índice único. El handler debe capturar el error `23505` de Postgres y devolver también `409`, no `500`.
- **Sin paginación en servidor.** `GET /api/categories` devuelve todo. Con centenares de filas el payload y el filtrado en cliente empiezan a pesar. Umbral de revisión: ~500 categorías, o antes si el `DataTable` se reutiliza para productos.
- **Borrado físico y Fase 2.** Cuando `products.category_id` exista, borrar una categoría con productos debe fallar de forma controlada (`ON DELETE RESTRICT` + 409 con mensaje claro), no dejar productos huérfanos ni borrar en cascada. Hay que retomarlo al escribir el spec de productos.
- **`SETUP.md` §1 desactualizado.** Declara TanStack Table v8 y la instalada es v9.2.3. Un developer que siga `SETUP.md` al pie escribirá `useReactTable` y no compilará. Vale actualizar esa fila del documento en un cambio aparte.
- **`createRouteMatcher` deprecado.** Clerk emite un warning de deprecación sobre el patrón actual de `proxy.ts`. Esta fase no lo migra (solo añade una excepción dentro del mismo patrón); la migración a `auth.protect()` por recurso corresponde al spec de auth.
- **Rollback.** Revertir implica: `drizzle/0000_*` + `DROP TABLE categories`, deshacer T10 en `proxy.ts` y borrar los archivos nuevos. No hay datos previos que migrar.

## 11. Fuera de alcance / deuda aceptada

- **Autenticación y RBAC (deuda técnica intencional).** Decisión explícita del usuario para la Fase 1: los Route Handlers de categorías no llevan `requirePermission` ni guard de rol, y el layout admin no verifica sesión. Es una **excepción temporal y consciente a la regla dura §4.8 de `CLAUDE.md`** (proteger admin en `proxy.ts` + verificación por código de permiso). Se retoma en un spec futuro de auth/RBAC, que debe: (a) revertir la excepción de `proxy.ts` de T10, (b) mover el CRUD a `/api/admin/categories`, (c) añadir `requirePermission('categories.create' | 'categories.update' | 'categories.delete')` y sembrar esos permisos, (d) dejar `GET` público para el storefront.
- **Auditoría.** No se escribe en `audit_logs` (CLAUDE.md §4.9): la tabla no existe y no hay actor identificable sin auth. Se retoma junto con el spec de auditoría, que deberá cubrir también las mutaciones de categorías.
- **Jerarquía padre/hijo.** Lista plana. Añadir después una columna `parent_id uuid` autorreferenciada y nullable es una migración aditiva que no rompe datos existentes; se retoma si el catálogo necesita subcategorías.
- **Imagen o ícono de categoría.** Requiere storage de blobs, hoy no configurado. Se retoma junto con la galería de productos.
- **`GET /api/categories/[id]`.** No se implementa: el diálogo de edición ya recibe la fila desde la caché de la lista. Se añade cuando exista una vista de detalle o un enlace directo.
- **Paginación, orden y búsqueda en servidor.** Diferido a la Fase 2 de productos, donde el volumen lo justifica.
- **Seed de categorías.** `src/server/db/seed.ts` no existe; se crea con el seed de `permissions` y roles de sistema.
- **Vista de categorías en el storefront.** Fuera de alcance: este spec es `scope: admin`.
