---
id: 009
title: Mis compras — historial agrupado por fecha con detalle y boleta
status: done
module: profile
scope: client
---

# 009 — Mis compras — historial agrupado por fecha con detalle y boleta

## Objetivo
Un usuario autenticado ve en `/account` › "Mis compras" sus pedidos pagados agrupados por
día, los filtra por mes actual o rango de fechas, y abre el detalle con la boleta de Stripe.

## Alcance
Incluye:
- `GET /api/orders` — historial del usuario en sesión, filtrado por instante `from`/`to`.
- `GET /api/orders/[orderId]/receipt` — resuelve el `receipt_url` del cargo en Stripe.
- Agrupación visual por día (día, mes, año) en orden descendente.
- Filtro "Mes actual" | "Rango de fechas" con dos `input[type=date]`.
- `Dialog` de detalle con las líneas de `order_items` y botón a la boleta.
- Sustituir el estado vacío de la pestaña "Mis compras" (007 T4) por la sección real.

No incluye:
- Favoritos, panel `/admin/orders`, repetir pedido, cancelaciones ni devoluciones.
- Paginación/scroll infinito: el filtro acota el periodo (tope duro de 200 pedidos).
- Facturas fiscales de Stripe (`invoice_creation` no está activo en 008): la boleta es
  el recibo del cargo.
- Cambios de esquema o de `proxy.ts` (`/api/orders` ya exige sesión: no está en `isPublicRoute`).

## Criterios de aceptación
- [x] AC1 — Dado un usuario con pedidos, cuando abre "Mis compras", entonces ve el mes actual agrupado por día, con cabecera tipo "9 de septiembre de 2026" y días más recientes arriba.
- [x] AC2 — Dado el filtro "Rango de fechas" con desde/hasta válidos, cuando aplica, entonces solo aparecen pedidos de ese intervalo (ambos días incluidos).
- [x] AC3 — Dado un rango con "hasta" anterior a "desde" o mayor de 400 días, cuando se envía, entonces la API responde 400 y la UI muestra el mensaje sin perder el listado previo.
- [x] AC4 — Dado un periodo sin compras, cuando termina la carga, entonces se muestra el estado vacío con CTA a `/products`.
- [x] AC5 — Dado el estado de carga, entonces hay skeletons; dado un fallo de red, entonces hay mensaje de error y botón "Reintentar".
- [x] AC6 — Dado un pedido, cuando abre "Ver detalle", entonces el `Dialog` lista cada línea con nombre, cantidad, precio unitario y subtotal, y el total coincide con `orders.total_cents`.
- [x] AC7 — Dado un pedido pagado, cuando el diálogo resuelve la boleta, entonces "Descargar boleta" abre el `receipt_url` en pestaña nueva; si Stripe aún no lo expone, el botón queda deshabilitado con la razón.
- [x] AC8 — Dado un `orderId` de otro usuario, cuando pide su boleta, entonces responde 404 (no 403: no se confirma la existencia del pedido ajeno).
- [x] AC9 — Dado un usuario anónimo o sin fila en `users`, cuando llama a cualquiera de los dos endpoints, entonces responde 401.
- [x] AC10 — Dado un pedido `pending`, `failed` o `canceled`, entonces no aparece en el historial.

## Datos
Sin cambios de esquema. Se lee de `orders` (`id`, `status`, `total_cents`, `currency`,
`stripe_payment_intent_id`, `created_at`) y `order_items` (`id`, `product_id`,
`product_name`, `unit_price_cents`, `quantity`). Índice `orders_user_created_idx`
(`user_id`, `created_at desc`) ya cubre el filtro. Tipos vía `Order`/`OrderItem`
(`InferSelectModel`), sin redeclararlos.

Agrupación por día: **en el cliente**, no en SQL. `date_trunc` agruparía en la TZ del
servidor (UTC) y partiría mal los pedidos de la noche para el usuario. El repositorio
devuelve filas ordenadas por `created_at desc`; una función pura las agrupa por día local.

## API
| Método | Ruta | Auth | Query / Body | Response |
|---|---|---|---|---|
| GET | `/api/orders` | Clerk (sesión, autoservicio: sin `permission.code`) | `from`, `to` (ISO datetime) | 200 `{ items: OrderHistoryItem[] }` · 400 Zod · 401 · 500 |
| GET | `/api/orders/[orderId]/receipt` | Clerk (sesión) | `orderId` uuid en la ruta | 200 `{ url: string \| null }` · 400 · 401 · 404 · 502 Stripe |

Zod `orderHistoryQuerySchema` (`from`, `to` como `z.iso.datetime()`), refinado: `to > from`
y span ≤ 400 días. Ambos obligatorios: el preset "mes actual" también se calcula en el
navegador y viaja como instante absoluto, así el servidor nunca adivina zona horaria.

`OrderHistoryItem` = cabecera + `items: OrderHistoryLine[]`, con `createdAt` serializado a
ISO string. Sin `stripe_payment_intent_id` en la respuesta (dato interno).

## Reutilizar
- `src/lib/auth.ts` — `getCurrentUserState()` para el 401 y el `users.id` del filtro.
- `src/lib/stripe.ts` — cliente único; `paymentIntents.retrieve(id, { expand: ["latest_charge"] })` → `latest_charge.receipt_url` (verificado en `stripe docs api charge`; es nullable).
- `src/server/repositories/order.repository.ts` — aquí va la query nueva; `findWithItems` ya muestra el patrón de join + reducción a `OrderWithItems`.
- `src/lib/axios.ts` (`api`) · `src/lib/api-error.ts` (`getApiErrorMessage`).
- `src/modules/storefront/services/catalog.service.ts` — patrón de service; `src/modules/storefront/hooks/use-catalog-products.ts` — patrón de hook + query keys.
- `src/modules/products/constants.ts` — `formatPrice()` (EUR, `es-ES`); no crear otro formateador de moneda.
- `src/modules/profile/components/account-empty-section.tsx` — estado vacío de AC4.
- `src/modules/profile/components/account-tabs.tsx` — punto de montaje (ya es `"use client"`).
- shadcn instalados y suficientes: `dialog`, `card`, `select`, `input`, `label`, `button`, `badge`, `separator`, `skeleton`, `scroll-area`, `table`, `empty`. **No instalar `calendar`**: arrastra `react-day-picker` y dos `input[type=date]` cubren AC2.
- `lucide-react` — `Package`, `Receipt`, `CalendarDays`, `Download`.

## Tareas
- [x] T1 — Schema Zod del query + tipos `OrderHistoryItem`/`OrderHistoryLine` · `src/modules/profile/schemas/order-history.schema.ts`
- [x] T2 — Query `findHistoryByUserId({ userId, from, to })`: join `order_items`, `status = 'paid'`, `created_at` en `[from, to)`, orden `created_at desc`, `limit 200` · `src/server/repositories/order.repository.ts`
- [x] T3 — Route Handler del historial: 401 + Zod + mapeo a `OrderHistoryItem[]` · `src/app/api/orders/route.ts`
- [x] T4 — Servicio de servidor `resolveOrderReceiptUrl(userId, orderId)`: valida propiedad y `paid`, resuelve el `receipt_url` en Stripe · `src/server/services/order-receipt.service.ts`
- [x] T5 — Route Handler de la boleta (`params` es `Promise` en Next.js 16) · `src/app/api/orders/[orderId]/receipt/route.ts`
- [x] T6 — Service axios `getOrderHistory()` + `getOrderReceipt()` · `src/modules/profile/services/order-history.service.ts`
- [x] T7 — Query keys + presets de rango (`getCurrentMonthRange()`, `toRangeFromDateInputs()`) · `src/modules/profile/constants.ts`
- [x] T8 — Función pura `groupOrdersByDay()` (Map por día local + etiqueta `Intl.DateTimeFormat("es-ES", { dateStyle: "long" })`) · `src/modules/profile/lib/group-orders-by-day.ts`
- [x] T9 — Hook `useOrderHistory(range)` (`useQuery`, `placeholderData` para no vaciar la lista al refiltrar) · `src/modules/profile/hooks/use-order-history.ts`
- [x] T10 — Hook `useOrderReceipt(orderId, enabled)` (`useQuery`, solo se dispara con el diálogo abierto) · `src/modules/profile/hooks/use-order-receipt.ts`
- [x] T11 — Filtro presentacional: `Select` mes actual/rango + dos `input[type=date]` + botón Aplicar · `src/modules/profile/components/order-history-filter.tsx`
- [x] T12 — Cabecera de día + tarjetas de pedido del grupo · `src/modules/profile/components/order-day-group.tsx`
- [x] T13 — `Dialog` de detalle con las líneas, el total y el botón de boleta (estados: cargando / disponible / no disponible) · `src/modules/profile/components/order-detail-dialog.tsx`
- [x] T14 — Contenedor `"use client"` con estado del filtro y los tres estados obligatorios (skeleton / error+reintentar / vacío) · `src/modules/profile/components/order-history-section.tsx`
- [x] T15 — Sustituir el `AccountEmptySection` de la pestaña "orders" por `OrderHistorySection` · `src/modules/profile/components/account-tabs.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- **N+1.** El historial trae las líneas en el mismo join que las cabeceras: el diálogo no
  vuelve a la red por el detalle, solo por la boleta.
- **Boleta ≠ factura.** 008 crea la sesión sin `invoice_creation`, así que no existe
  `hosted_invoice_url`. La única boleta es `charge.receipt_url`, que es `nullable` y puede
  tardar en aparecer; de ahí el `{ url: null }` de AC7 en vez de un error.
- **Popup blocker.** La boleta se resuelve al abrir el diálogo y se pinta como
  `<Button asChild><a target="_blank" rel="noopener noreferrer">`. Un `window.open()`
  después de un `await` lo bloquea el navegador.
- **Rango inclusivo.** El "hasta" del usuario es un día completo: se envía el inicio del día
  siguiente y el filtro SQL es `[from, to)`, para no perder las compras de esa tarde.
