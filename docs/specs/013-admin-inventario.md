---
id: 013
title: Inventario — reposición de stock y umbral de alerta
status: in-progress
module: inventory
scope: admin
---

# 013 — Inventario — reposición de stock y umbral de alerta

## Contexto
011 añadió `products.low_stock_threshold` y lo usa para su KPI y su lista de "stock bajo",
ambas de solo lectura: **nadie puede editar el umbral desde ninguna UI**. El stock sí se
edita, pero solo dentro del formulario de alta/edición de 002
(`product-form-dialog.tsx`, campo "Stock"), que reemplaza el total a ciegas y no deja
rastro: `PATCH /api/products/[id]` no escribe en `audit_logs`. Reponer diez unidades hoy
obliga a abrir la ficha completa del producto, leer el stock, sumar a mano y guardar.

**Precondición ya resuelta:** al momento de redactar este spec, `low_stock_threshold` y su
migración `drizzle/0005_aspiring_wolfsbane.sql` solo existían en `feat/011-admin-dashboard-metricas`
sin fusionar. El PR #1 (011) ya se mergeó a `master` antes de aprobar este spec, así que la
columna está disponible desde la base de la rama de 013. Se deja la nota como registro de la
verificación, no como bloqueante activo.

## Objetivo
Un administrador con `products.update` abre `/admin/inventory`, ve qué productos están
agotados o bajo mínimos, repone unidades y ajusta el umbral de alerta de cada uno, y cada
cambio queda registrado en `audit_logs` con su autor.

## Alcance
Incluye:
- `/admin/inventory`: tabla de productos vivos ordenada por stock ascendente, con badge de
  estado (Agotado / Stock bajo / OK) y filtro "solo stock bajo".
- Reposición por fila: input de cantidad + "Agregar". **Suma** al stock actual, no lo sustituye.
- Ajuste inline del umbral de alerta por fila.
- Auditoría de ambas mutaciones (`product.stock_adjusted`, `product.low_stock_threshold_updated`)
  en el mismo `db.batch` que la mutación.

No incluye:
- Tocar `/admin/products` ni su formulario: sigue siendo el sitio para corregir stock a la baja.
- Restar stock desde inventario, historial de movimientos como vista propia, alertas por
  email, proveedores, órdenes de compra o costos de reposición.
- **Permiso RBAC nuevo**: se reutilizan `products.view` y `products.update` (ver §Decisiones 2).
- Lo que cubre 014 (finanzas).

## Criterios de aceptación
- [ ] AC1 — Dado un admin con `products.view`, cuando abre `/admin/inventory`, entonces ve todos los productos no borrados ordenados por stock ascendente (los agotados primero).
- [ ] AC2 — Dado `stock = 0` el badge es "Agotado"; dado `0 < stock <= lowStockThreshold` es "Stock bajo"; dado `stock > lowStockThreshold` es "OK".
- [ ] AC3 — Dado el filtro "solo stock bajo" activo, entonces la tabla muestra únicamente agotados y bajo mínimos; desactivado, muestra todo.
- [ ] AC4 — Dado un producto con stock 3 y cantidad 10, cuando el admin pulsa "Agregar", entonces el stock queda en 13 (suma, no reemplazo) y la fila se refresca sin recargar la página.
- [ ] AC5 — Dada una cantidad 0, negativa, decimal o vacía, entonces el botón no dispara la petición y el endpoint responde 400 con los `issues` de Zod sin tocar la base.
- [ ] AC6 — Dado un umbral entero `>= 0`, cuando el admin lo confirma, entonces se guarda y los badges se recalculan; un valor negativo o decimal se rechaza con 400.
- [ ] AC7 — Dada una reposición correcta, entonces `audit_logs` recibe una fila `product.stock_adjusted` con `actorId`, `entityId` del producto y `changes = { before: { stock }, after: { stock } }` más `metadata.delta`.
- [ ] AC8 — Dado un cambio de umbral, entonces `audit_logs` recibe `product.low_stock_threshold_updated` con `before`/`after`.
- [ ] AC9 — Dado un fallo de la mutación, entonces **ni** el stock **ni** el log se escriben: ambas sentencias viajan en el mismo `db.batch`.
- [ ] AC10 — Dado un usuario sin `products.view`, entonces `proxy.ts` lo desvía a `/admin/forbidden`, `GET /api/admin/inventory` responde 403 (401 sin sesión) y el ítem "Inventario" no aparece en la barra lateral.
- [ ] AC11 — Dado un usuario con `products.view` pero sin `products.update`, entonces ve la tabla y los dos endpoints `PATCH` le responden 403.
- [ ] AC12 — Dado un `productId` inexistente o borrado, entonces el `PATCH` responde 404.
- [ ] AC13 — Dado el estado de carga hay skeletons; dado un fallo de red hay mensaje y reintento; dado 0 resultados hay estado vacío; toda mutación da feedback con `toast`.

## Datos
**Sin cambios de esquema y sin migración.** `products.stock` (integer, notNull, default 0,
check `products_stock_non_negative`) y `products.low_stock_threshold` (integer, notNull,
default 5, check `>= 0`, llega con 011) son todo lo que se necesita. `audit_logs` ya existe
desde 003 y es append-only.

Lectura del listado: `products` (`id`, `name`, `sku`, `stock`, `low_stock_threshold`,
`is_active`) + `categories.name` por join. Tipos vía `InferSelectModel`, sin redeclarar.

Acciones nuevas en `AUDIT_ACTIONS` (`src/lib/audit.ts`), `entityType: "product"`:
`product.stock_adjusted` · `product.low_stock_threshold_updated`.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/inventory` | `requirePermission("products.view")` | — | 200 `InventoryItem[]` · 401 · 403 · 500 |
| PATCH | `/api/admin/inventory/[productId]/stock` | `requirePermission("products.update")` | `{ quantity }` | 200 `InventoryItem` · 400 · 401 · 403 · 404 · 500 |
| PATCH | `/api/admin/inventory/[productId]/threshold` | `requirePermission("products.update")` | `{ threshold }` | 200 `InventoryItem` · 400 · 401 · 403 · 404 · 500 |

Zod: `adjustStockSchema` = `{ quantity: z.int().positive().max(100_000) }`;
`updateThresholdSchema` = `{ threshold: z.int().min(0).max(100_000) }`. El `productId` se
valida con `productIdSchema` (uuid) reutilizado de `modules/products/schemas`.

`InventoryItem` = `{ id, name, sku, categoryName, isActive, stock, lowStockThreshold }`.

## Reutilizar
- `src/lib/permissions.ts` — `requirePermission` / `requirePermissionInPage`. **No se añade ningún código a `PERMISSIONS`.**
- `src/lib/route-permissions.ts` — registrar `/admin/inventory` y `/api/admin/inventory` **antes** del `/admin` genérico (hallazgo recurrente de 011 y 012).
- `src/lib/audit.ts` — `buildAuditLogInsert()` (sentencia sin ejecutar, para el batch), `getRequestAuditContext(request)`; se le **añaden** dos acciones a `AUDIT_ACTIONS`.
- `src/server/db/batch.ts` — `runBatch()` y el tipo `PgStatement`.
- `src/server/repositories/product.repository.ts` L382 `buildStockDecrement` — patrón exacto de mutación que devuelve `PgStatement`; las funciones nuevas viven en este mismo archivo.
- `src/app/api/admin/users/[id]/roles/route.ts` — patrón completo guard → Zod → lectura previa (el `before` del log) → `runBatch([mutación, buildAuditLogInsert(...)])` → relectura → respuesta.
- `src/app/api/products/[id]/route.ts` — forma de los 400/404 y del `safeParse` del id.
- `src/components/shared/data-table.tsx` — `DataTable` (búsqueda, orden, paginación client-side). No admite `initialSorting`: el orden por defecto lo fija el `ORDER BY` del repositorio.
- `src/modules/products/{constants.ts,types/product.types.ts}` — `formatPrice`, reexport de tipos sin arrastrar Drizzle al bundle.
- `src/modules/orders/components/admin-orders-table.tsx` — contenedor cliente con carga / error+reintentar / vacío.
- `src/modules/audit-logs/constants.ts` — `AUDIT_ACTION_LABELS` (`Record<string, string>` con fallback): añadir las dos etiquetas nuevas.
- `src/lib/axios.ts` (`api`) · `src/lib/api-error.ts` (`getApiErrorMessage`) · `src/testing/mocks/db.mock.ts` (`mockDbQuery()`).
- shadcn ya instalados y suficientes: `table`, `input`, `button`, `badge`, `switch`, `skeleton`, `empty`, `tooltip`, `sonner`. **No falta ninguno; no se instala nada.**

## Decisiones técnicas
1. **Página propia, módulo propio.** `src/modules/inventory/` es un dominio nuevo (la lista
   de `docs/SETUP.md` §163 es ilustrativa, no cerrada, como ya lo fueron `audit-logs` y
   `storefront`). No se toca `modules/products/`: su CRUD y su caché siguen intactos.
2. **Cero permisos nuevos.** Crear uno obligaría a resincronizar el `publicMetadata` de
   Clerk de todos los usuarios con esos roles, y hoy no hay mecanismo automático (mordió al
   equipo en 012). `products.view`/`products.update` ya están sembrados para `super_admin`,
   `admin` y `manager` — exactamente el set que necesita este módulo.
3. **Dos endpoints, uno por acción**, no un `PATCH` genérico de inventario: cada uno tiene
   su Zod, su acción de auditoría y su `changes`. Un handler que mezclara ambos campos
   tendría que adivinar qué log escribir.
4. **Estas dos mutaciones sí auditan**, a diferencia del `PATCH /api/products/[id]` genérico
   que no lo hace. Saber quién repuso qué y cuándo es la razón de ser del módulo. No se
   "arregla" de paso el handler de 002: está fuera de alcance.
5. **Suma en SQL, no en JS.** `set({ stock: sql\`${product.stock} + ${quantity}\` })` evita
   la carrera leer-sumar-escribir de dos reposiciones simultáneas. El `before` que necesita
   el log se lee **antes** del batch (`neon-http` no permite leer dentro).
6. **Relectura tras el batch.** `db.batch()` no devuelve filas (`runBatch` es `void`), así
   que la respuesta se arma releyendo el producto, como el `PUT` de roles.
7. **GET propio, no `GET /api/products`**: ese endpoint es **público** (sirve al storefront)
   y devuelve la fila completa sin ordenar por stock. El de inventario va protegido y
   devuelve solo las seis columnas que pinta la tabla.
8. **Filtrado client-side.** El catálogo es acotado y cabe entero en memoria, como
   `products`/`users`/`roles`; no necesita los filtros server-side que sí exigió 012.

## Tareas
- [x] T1 — `PRODUCT_STOCK_ADJUSTED` y `PRODUCT_LOW_STOCK_THRESHOLD_UPDATED` en `AUDIT_ACTIONS` · `src/lib/audit.ts`
- [x] T2 — Etiquetas de las dos acciones · `src/modules/audit-logs/constants.ts`
- [x] T3 — `/admin/inventory` y `/api/admin/inventory` en `ADMIN_ROUTE_PERMISSIONS` (antes de `/admin`) y `/admin/inventory` en `ADMIN_SECTION_FALLBACKS` · `src/lib/route-permissions.ts`
- [x] T4 — Test de las rutas nuevas · `src/lib/route-permissions.test.ts`
- [x] T5 — Ítem "Inventario" con `requiredPermission: "products.view"`, tras "Productos" · `src/components/shared/admin-sidebar.tsx`
- [x] T6 — `findInventory()`: join a `categories`, `deleted_at is null`, `order by stock asc, name asc`, proyección de seis columnas · `src/server/repositories/product.repository.ts`
- [x] T7 — `buildStockIncrement(id, quantity)` y `buildLowStockThresholdUpdate(id, threshold)`, ambas `PgStatement` sin ejecutar y acotadas a `deleted_at is null` · mismo archivo
- [x] T8 — Tests de T6/T7 con `mockDbQuery()` · `src/server/repositories/product.repository.test.ts`
- [x] T9 — `adjustStockSchema`, `updateThresholdSchema` y el tipo `InventoryItem` · `src/modules/inventory/schemas/inventory.schema.ts`
- [x] T10 — Tests del schema (0, negativo, decimal, tope) · `…/inventory.schema.test.ts`
- [x] T11 — Route Handler `GET /api/admin/inventory` · `src/app/api/admin/inventory/route.ts`
- [x] T12 — Route Handler `PATCH …/[productId]/stock`: guard → Zod → lectura previa → `runBatch([incremento, log])` → relectura · `src/app/api/admin/inventory/[productId]/stock/route.ts`
- [x] T13 — Route Handler `PATCH …/[productId]/threshold`, mismo patrón · `…/[productId]/threshold/route.ts`
- [x] T14 — Service axios `getInventory`, `adjustStock`, `updateLowStockThreshold` · `src/modules/inventory/services/inventory.service.ts` (+ test)
- [x] T15 — `inventoryKeys`, `STOCK_STATUS_LABELS`/`_VARIANTS` y `getStockStatus(stock, threshold)` puro · `src/modules/inventory/constants.ts`
- [x] T16 — Tests de `getStockStatus` (frontera `stock === threshold`, `threshold = 0`) · `…/constants.test.ts`
- [x] T17 — Hook `useInventory()` · `src/modules/inventory/hooks/use-inventory.ts`
- [x] T18 — Hooks `useAdjustStock()` y `useUpdateLowStockThreshold()` con invalidación de `inventoryKeys.all` **y** `productKeys.all` · `src/modules/inventory/hooks/use-inventory-mutations.ts`
- [x] T19 — Celda de reposición: input numérico + "Agregar", deshabilitado mientras la mutación corre · `src/modules/inventory/components/stock-adjust-cell.tsx`
- [x] T20 — Celda de umbral inline (edita, confirma, cancela) · `src/modules/inventory/components/threshold-cell.tsx`
- [x] T21 — Columnas: producto, SKU, categoría, stock, umbral, estado con `Badge`, reposición · `src/modules/inventory/components/inventory-columns.tsx`
- [x] T22 — Contenedor `"use client"`: toggle "solo stock bajo" + `DataTable` + estados de carga / error+reintentar / vacío · `src/modules/inventory/components/inventory-table.tsx`
- [x] T23 — Página Server Component con `requirePermissionInPage("products.view")` · `src/app/(admin)/admin/inventory/page.tsx`

Verificación final: `npm run typecheck && npm run lint && npm run test` (el `build` lo corre el reviewer)

## Notas
- **Orden del mapa de rutas.** `/admin` (genérico) se resuelve por primera coincidencia y va
  el último: si `/admin/inventory` se registra después, quedaría exigiendo `dashboard.view`.
- **Defensa en capas contra el check.** `products_stock_non_negative` nunca debería dispararse
  (Zod exige `quantity > 0` y la SQL solo suma), pero el tope de `100_000` en el schema existe
  por otra razón: el `integer` de Postgres desborda en 2.147.483.647 y un pegado accidental de
  quince dígitos tumbaría el batch con un error críptico.
- **`before` fuera del batch.** La lectura previa y la mutación no son atómicas entre sí: dos
  reposiciones simultáneas producen dos logs con el mismo `before`. El **stock** es correcto
  (la suma es atómica en SQL); lo que puede quedar desalineado es el `delta` narrado. Es el
  mismo compromiso que ya acepta el `PUT` de roles y no se resuelve con `neon-http`.
- **Producto borrado en carrera.** Si el producto recibe soft delete entre la lectura previa y
  el batch, el `UPDATE` no afecta filas pero el log sí se escribe. La relectura posterior
  devuelve 404 al cliente; el log queda como un intento registrado, que es información válida
  para una bitácora append-only.
- **Doble invalidación.** La tabla de `/admin/products` también pinta stock: una reposición
  debe invalidar `productKeys.all` además de `inventoryKeys.all` o esa vista quedará mintiendo
  hasta el siguiente `refetch`.
- **Sin PII en el log.** `changes` lleva solo enteros y `metadata` el `source`; nada que el
  enmascarado de `audit.ts` tenga que redactar.
