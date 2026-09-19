---
id: 012
title: Administración de pedidos — listado con filtros y detalle
status: done
module: orders
scope: admin
---

# 012 — Administración de pedidos — listado con filtros y detalle

## Contexto
`admin-sidebar.tsx` enlaza "Pedidos" a `/admin/orders`, pero `src/app/(admin)/admin/orders/`
está vacía: la navegación cae en 404. El ítem tampoco declara `requiredPermission` ("Pedidos
y Clientes siguen sin página real…"), porque el catálogo RBAC de 003 §5.1 no tiene ningún
permiso `orders.*`. 008 ya llena `orders`/`order_items` desde el webhook de Stripe y 009 ya
resuelve el lado cliente ("Mis compras"), así que el dato existe y nadie del panel lo ve.

## Objetivo
Un administrador con `orders.view` abre `/admin/orders`, filtra los pedidos por fecha,
estado y cliente, y abre el detalle de cualquiera con sus líneas y su boleta de Stripe.

## Alcance
Incluye:
- Permiso nuevo `orders.view` en el catálogo RBAC, sembrado para `super_admin`, `admin` y `manager`.
- `/admin/orders`: tabla de pedidos (fecha, cliente, estado, nº de líneas, total).
- Tres filtros **resueltos en el servidor**: rango de fechas, estado exacto, texto libre de cliente.
- Ventana por defecto de 90 días y tope duro de 500 filas, con aviso cuando se alcanza.
- Diálogo de detalle por pedido: cliente, estado, líneas de `order_items` y total.
- Enlace a la boleta de Stripe del pedido pagado (endpoint admin propio).

No incluye:
- **Cualquier mutación.** El estado del pedido lo sigue gobernando solo el webhook de 008:
  nada de cancelar, reembolsar ni reenviar desde la UI.
- `/admin/customers` (ítem "Clientes"): spec aparte, su nav item se queda como está.
- Exportación, impresión en lote, paginación server-side y búsqueda por nº de pedido.
- Tabla `customers` nueva: "cliente" sigue siendo una fila de `users`.
- Dirección de envío: vive en Stripe, no en Postgres.
- Lo que cubren 013 (inventario) y 014 (finanzas).

## Criterios de aceptación
- [x] AC1 — Dado un admin con `orders.view`, cuando abre `/admin/orders`, entonces ve los pedidos de los últimos 90 días de **todos** los estados, del más reciente al más antiguo.
- [x] AC2 — Dado un usuario sin `orders.view`, cuando entra a `/admin/orders`, entonces `proxy.ts` lo desvía a `/admin/forbidden`; y `GET /api/admin/orders` responde 403 (401 sin sesión) sin filtrar datos.
- [x] AC3 — Dado un usuario sin `orders.view`, cuando se pinta la barra lateral, entonces el ítem "Pedidos" no aparece.
- [x] AC4 — Dado el filtro de estado en `paid`, entonces solo vuelven pedidos `paid`; sin filtro vuelven los cuatro estados.
- [x] AC5 — Dado el texto `ana` en el filtro de cliente, entonces vuelven los pedidos cuyo `users.first_name`, `last_name` o `email` contengan `ana` sin distinguir mayúsculas (coincidencia parcial).
- [x] AC6 — Dado un rango `from`/`to`, entonces el filtro se aplica en SQL sobre `created_at` como intervalo `[from, to)`; sin fechas, la ventana es de 90 días hacia atrás.
- [x] AC7 — Dados varios filtros activos, entonces se combinan con AND en una sola consulta.
- [x] AC8 — Dado un resultado que alcanza las 500 filas, entonces la UI avisa de que hay más y pide acotar el periodo; nunca se devuelven más de 500.
- [x] AC9 — Dado un pedido de la tabla, cuando el admin abre su detalle, entonces ve nombre y email del cliente, estado, fecha, cada línea con `product_name` congelado, cantidad y precio unitario, y el total leído de `orders.total_cents` (no recalculado).
- [x] AC10 — Dado un pedido `paid`, entonces el detalle ofrece "Ver boleta" hacia el `receipt_url` de Stripe; si Stripe aún no la expone se informa sin romper; un pedido no pagado no muestra el botón.
- [x] AC11 — Dados query params inválidos, entonces el endpoint responde 400 con los `issues` de Zod y no consulta la base.
- [x] AC12 — Dado el estado de carga hay skeletons; dado un fallo de red hay mensaje y "Reintentar"; dado 0 resultados hay estado vacío.
- [x] AC13 — Dados importes en centavos, entonces se muestran con `formatPrice()`; sin decimales en ningún cálculo.

## Datos
**Sin cambios de esquema.** No hay migración: `orders`, `order_items` y `users` ya tienen
todo lo necesario y `permissions`/`role_permissions` existen desde 003.

Único cambio de datos — **semilla** (`npm run db:seed`, idempotente por
`onConflictDoNothing` sobre `permissions.code` y sobre la PK de `role_permissions`):

| `code` | `resource` | `action` | Roles |
|---|---|---|---|
| `orders.view` | `orders` | `view` | `super_admin` (vía `ALL_PERMISSION_CODES`), `admin`, `manager` |

Lectura: `orders` (`id`, `user_id`, `status`, `total_cents`, `currency`, `created_at`,
`stripe_payment_intent_id`), `order_items` (`order_id`, `product_name`, `unit_price_cents`,
`quantity`), `users` (`id`, `first_name`, `last_name`, `email`). Tipos vía
`InferSelectModel`, sin redeclarar.

## API
| Método | Ruta | Auth | Query / Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/orders` | `requirePermission("orders.view")` | `from?`, `to?`, `status?`, `customer?` | 200 `AdminOrderListResponse` · 400 · 401 · 403 · 500 |
| GET | `/api/admin/orders/[orderId]` | idem | — | 200 `AdminOrderDetail` · 400 · 404 · 500 |
| GET | `/api/admin/orders/[orderId]/receipt` | idem | — | 200 `OrderReceiptResponse` · 404 · 502 · 500 |

Zod `adminOrderFiltersSchema`: `from`/`to` ISO datetime opcionales (`z.coerce.date()`),
`status` enum de `orderStatus` opcional, `customer` texto trim 1–120 opcional; `refine` de
orden (`to > from`). `orderIdSchema` (uuid) se reutiliza tal cual de 009.

`AdminOrderListResponse` = `{ items: AdminOrderListItem[]; truncated: boolean }` con
`AdminOrderListItem` = `{ id, createdAt (ISO), status, totalCents, currency, itemCount,
customer: { id, name, email } }`. `AdminOrderDetail` = cabecera + `customer` + `items: {
id, productName, unitPriceCents, quantity }[]`. `truncated` es `items.length === 500`.

## Reutilizar
- `src/lib/permissions.ts` — `requirePermission` / `requirePermissionInPage`; se le **añade** `ORDERS_VIEW` al `PERMISSIONS`, no se cambia su mecánica. Nunca comparar nombres de rol.
- `src/lib/route-permissions.ts` — mapa de `proxy.ts`; hay que registrar las rutas nuevas además del guard del handler (hallazgo de 011 que no se repite).
- `src/app/api/admin/audit-logs/route.ts` — patrón exacto de handler admin con filtros Zod desde `searchParams`.
- `src/modules/audit-logs/{schemas,services,hooks,constants}` — precedente vivo de filtros que viajan al servidor: `toQueryParams` (omite vacíos), query keys con los filtros dentro, `formatDateTime`. Reutilizar `formatDateTime` de `constants.ts`, no escribir otro.
- `src/modules/audit-logs/components/audit-logs-table.tsx` — barra `draft`/`applied` con dos `input[type="date"]` + "Aplicar" / "Limpiar". **No instalar `calendar`**: mismo criterio que 009.
- `src/components/shared/data-table.tsx` — `DataTable` para orden y paginación de la página ya filtrada. **No pasarle `filters`** (sus `Select` son exact-match y no expresan un rango): la barra propia los sustituye.
- `src/server/repositories/order.repository.ts` — `findWithItems(orderId)` ya no comprueba dueño: es la query del detalle admin. Las queries nuevas viven en este mismo archivo.
- `src/server/repositories/user.repository.ts` — `findById(id)` para el cliente del detalle.
- `src/server/services/order-receipt.service.ts` — resolución `paymentIntents.retrieve(id, { expand: ["latest_charge"] })` → `latest_charge.receipt_url`, con sus estados `ok | not_found | stripe_unavailable`.
- `src/modules/profile/{components/order-detail-dialog.tsx,hooks/use-order-receipt.ts}` — forma del diálogo de detalle y de la carga perezosa de la boleta (009).
- `src/server/repositories/product.repository.ts` L128 — precedente de `or(ilike(...), ilike(...))` con patrón `%q%`.
- `src/modules/products/constants.ts` — `formatPrice(cents)`.
- `src/lib/axios.ts` (`api`) · `src/lib/api-error.ts` (`getApiErrorMessage`) · `src/testing/mocks/db.mock.ts` (`mockDbQuery()`).
- shadcn ya instalados y suficientes: `table`, `dialog`, `select`, `input`, `label`, `button`, `badge`, `skeleton`, `empty`, `separator`. **No falta ninguno.**

## Decisiones técnicas
1. **Módulo `src/modules/orders/`**, hoy carpeta vacía reservada por `docs/SETUP.md` §163
   (un módulo por dominio, no por scope). No se inventa `admin-orders`: el lado cliente de
   009 vive en `profile` por ser una pestaña de `/account`, y ahí se queda.
2. **Filtros en SQL, no en memoria.** `users`/`roles` cargan el catálogo entero porque es
   fijo y pequeño; los pedidos crecen sin techo y el rango de fechas no es expresable con
   los `Select` de `DataTable`. Los tres filtros viajan como query params.
3. **90 días / 500 filas** como en 009 "el periodo sustituye a la paginación", pero con
   ventana propia: un panel mira el mes en curso, no el año pasado. Las constantes viven en
   una sola fuente de verdad (`DEFAULT_RANGE_DAYS`, `ADMIN_ORDER_LIMIT`), no duplicadas
   entre cliente y servidor.
4. **Lista sin líneas, detalle bajo demanda.** Traer 500 pedidos con su desglose multiplica
   las filas por nada: la lista lleva `itemCount` (agregado) y el diálogo pide el detalle al
   abrirse (`enabled` del hook).
5. **Boleta en endpoint aparte**, como 009: la llamada a Stripe es lenta y no debe frenar el
   diálogo. La lógica Stripe se extrae a un helper interno compartido por la variante de
   autoservicio (con dueño en el `where`) y la admin (sin dueño, con permiso).

## Tareas
- [x] T1 — `ORDERS_VIEW: "orders.view"` en `PERMISSIONS` · `src/lib/permissions.ts`
- [x] T2 — Entrada en `PERMISSION_CATALOG` y alta en `admin` y `manager` de `ROLE_PERMISSION_MATRIX`; correr `npm run db:seed` · `src/server/db/seed.ts`
- [x] T3 — `/admin/orders` y `/api/admin/orders` en `ADMIN_ROUTE_PERMISSIONS` (antes del `/admin` genérico) y `/admin/orders` en `ADMIN_SECTION_FALLBACKS` · `src/lib/route-permissions.ts`
- [x] T4 — Test de las rutas nuevas · `src/lib/route-permissions.test.ts`
- [x] T5 — `requiredPermission: "orders.view"` en el ítem "Pedidos" y comentario acotado a "Clientes" · `src/components/shared/admin-sidebar.tsx`
- [x] T6 — `adminOrderFiltersSchema` + tipos de salida + `DEFAULT_RANGE_DAYS` · `src/modules/orders/schemas/admin-order.schema.ts`
- [x] T7 — Tests del schema (rango invertido, estado desconocido, texto vacío) · `…/admin-order.schema.test.ts`
- [x] T8 — `AdminOrderFilters` + `findAdminOrders()`: join a `users`, `ilike` sobre nombre/email, `[from, to)`, estado exacto, `limit ADMIN_ORDER_LIMIT = 500`, `count` de líneas · `src/server/repositories/order.repository.ts`
- [x] T9 — `findById(orderId)` (cabecera sin líneas, para la boleta admin) · mismo archivo
- [x] T10 — Tests de T8/T9 con `mockDbQuery()` · `src/server/repositories/order.repository.test.ts`
- [x] T11 — Servicio `getAdminOrderDetail(orderId)`: `findWithItems` + `userRepository.findById` → `AdminOrderDetail | null` · `src/server/services/admin-order.service.ts`
- [x] T12 — Extraer el helper Stripe y añadir `resolveAdminOrderReceiptUrl(orderId)` (sin chequeo de dueño, solo `status === "paid"`) · `src/server/services/order-receipt.service.ts` (+ su test)
- [x] T13 — Route Handler del listado: guard → Zod → repositorio → `{ items, truncated }` · `src/app/api/admin/orders/route.ts`
- [x] T14 — Route Handler del detalle (404 si no existe) · `src/app/api/admin/orders/[orderId]/route.ts`
- [x] T15 — Route Handler de la boleta (404 / 502) · `src/app/api/admin/orders/[orderId]/receipt/route.ts`
- [x] T16 — Service axios: `getAdminOrders`, `getAdminOrderDetail`, `getAdminOrderReceipt` (con `toQueryParams`) · `src/modules/orders/services/admin-order.service.ts` (+ test)
- [x] T17 — `adminOrderKeys`, `ORDER_STATUS_LABELS`/`ORDER_STATUS_OPTIONS` y `ADMIN_ORDER_LIMIT` · `src/modules/orders/constants.ts`
- [x] T18 — Hooks `useAdminOrders(filters)` y `useAdminOrderDetail(orderId)` (`enabled`) · `src/modules/orders/hooks/`
- [x] T19 — Hook `useAdminOrderReceipt(orderId)` calcado de 009 · `src/modules/orders/hooks/use-admin-order-receipt.ts`
- [x] T20 — Columnas de la tabla (fecha, cliente, estado con `Badge`, líneas, total, acción "Ver detalle") · `src/modules/orders/components/admin-order-columns.tsx`
- [x] T21 — Barra de filtros `draft`/`applied` (2 fechas, `Select` de estado, texto de cliente, Aplicar/Limpiar) · `src/modules/orders/components/admin-order-filters.tsx`
- [x] T22 — Diálogo de detalle con líneas, total y botón de boleta · `src/modules/orders/components/admin-order-detail-dialog.tsx`
- [x] T23 — Contenedor `"use client"`: filtros + `DataTable` + diálogo, con carga / error+reintentar / vacío / aviso de tope · `src/modules/orders/components/admin-orders-table.tsx`
- [x] T24 — Página Server Component con `requirePermissionInPage("orders.view")` · `src/app/(admin)/admin/orders/page.tsx`

Verificación final: `npm run typecheck && npm run lint && npm run test` (el `build` lo corre el reviewer)

## Notas
- **La semilla no basta para las sesiones vivas.** `getCurrentUser()` revalida contra
  Postgres en cada petición (003 AC11), así que el permiso nuevo aplica sin re-login; pero
  si el proyecto ya corrió el seed, `db:seed` debe volver a ejecutarse en cada entorno o
  `/admin/orders` responderá 403 a todo el mundo.
- **Orden del mapa de rutas.** `/admin` (genérico) va el último y se resuelve por primera
  coincidencia: si `/admin/orders` se añade después, quedaría exigiendo `dashboard.view`.
- **N+1 y coste.** `itemCount` se resuelve con un agregado en la misma consulta
  (`count(order_items.id)` + `group by`), nunca con una query por fila. Si el listado se
  vuelve lento, el índice a medir es `orders(status, created_at)`; no se añade a ciegas.
- **Filtro de cliente e índices.** `ilike '%texto%'` no usa índice: es aceptable porque el
  rango de fechas acota primero. No se introduce `pg_trgm` sin medición.
- **Zona horaria.** Los `input[type="date"]` dan fechas civiles; el cliente las convierte a
  instantes ISO antes de mandarlas (009), y el servidor no adivina zona horaria. `to` es
  exclusivo, así que el día final debe enviarse como el inicio del día siguiente o el propio
  día "hasta" quedará fuera.
- **Sin auditoría.** Leer no muta: no se escribe en `audit_logs` (es append-only para
  mutaciones). Si el negocio pide trazar consultas, es otro spec.

### Notas de implementación (T1–T15, backend)
- `ADMIN_ORDER_LIMIT` y `DEFAULT_RANGE_DAYS` viven ambos en
  `modules/orders/schemas/admin-order.schema.ts`, no en el repositorio: es el único
  archivo que servidor y cliente pueden importar sin arrastrar Drizzle al bundle, y
  §Decisiones 3 pide una sola fuente de verdad. **T17 los re-exporta desde
  `constants.ts`, no los redefine.**
- El schema exporta además `resolveAdminOrderRange(filters, now?)` (ventana por
  defecto, pura y testeada) y `toAdminOrderCustomer(user)` (constructor del DTO de
  cliente, compartido por listado y detalle).
- `ORDER_STATUS_VALUES` replica el pgEnum desde un `Record<OrderStatus, true>`: la
  exhaustividad la vigila el typecheck sin importar `orderStatus.enumValues` (runtime
  de Drizzle) en el cliente. T17 puede tipar `ORDER_STATUS_LABELS` contra él.
- Fallout de T1 no listado: `modules/roles/constants/permission-labels.ts` es un
  `Record<PermissionCode, string>` y exigía la etiqueta de `orders.view` para compilar.
- `customer=""` se rechaza con 400 en vez de ignorarse (a diferencia del `.catch()` de
  la bitácora): T16 debe omitir los filtros vacíos con `toQueryParams`.
- `getAdminOrderDetail()` lanza —no devuelve `null`— si `orders.user_id` no resuelve:
  es una inconsistencia de datos (FK notNull), no un 404, y el handler la traduce a 500.

### Notas de implementación (T16–T24, frontend)
- El filtro vacío se cae **dos veces**: `toAdminOrderQuery()` no compone un
  `customer` en blanco y `toQueryParams()` del service descarta cualquier valor
  vacío antes de armar el query string. Sin lo segundo, limpiar el campo de texto
  devolvería el 400 deliberado del schema (§Notas de implementación T1–T15).
- `AdminOrderQuery` (constants) es el contrato del cliente y se **deriva** de
  `AdminOrderFiltersQuery`: solo `from`/`to` cambian de forma a texto ISO, porque
  el `z.input` de un `z.coerce.date()` es `unknown` y no tipa ni el estado ni la
  clave de caché.
- `toAdminOrderQuery()` (puro y testeado en `constants.test.ts`) traduce la barra
  de filtros: fechas civiles a instantes locales y `to` empujado al arranque del
  día siguiente, porque el filtro SQL es `[from, to)`.
- La barra propia sustituye a los `filters` de `DataTable` (exact-match); a
  `DataTable` le quedan orden, paginación y búsqueda de la página ya filtrada, y
  su `emptyMessage` cubre el estado vacío de AC12.
- El diálogo recibe la fila del listado (cabecera instantánea) y solo va a la red
  por las líneas y por la boleta; la boleta únicamente si `status === "paid"`, así
  que un pedido no pagado no gasta una llamada a Stripe ni enseña el botón.
- `ORDER_STATUS_VARIANTS` acompaña a `ORDER_STATUS_LABELS` en `constants.ts` (no
  en las columnas, como el precedente de la bitácora) porque el badge lo pintan
  tabla y diálogo.
- `formatDateTime` se importa de `modules/audit-logs/constants` tal como pide
  §Reutilizar, en vez de escribir un segundo formateador.
