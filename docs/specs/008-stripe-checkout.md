---
id: 008
title: Pago con Stripe Checkout (hosted) y pedidos
status: done
module: checkout
scope: client
---

# 008 — Pago con Stripe Checkout (hosted) y pedidos

## Objetivo
Un cliente autenticado puede pagar el contenido de su carrito en Stripe Checkout y su
pedido queda registrado como `paid` con el stock descontado, confirmado por webhook.

## Alcance
Incluye:
- Dependencia `stripe` (Node SDK 22.x) y cliente único server-only en `src/lib/stripe.ts`.
- Schema `orders` + `order_items` con precio congelado por línea e ids de Stripe.
- `POST /api/checkout/session` — recalcula precio y valida stock/`isActive` en servidor.
- `POST /api/webhooks/stripe` — fulfillment idempotente + `audit_logs` en el mismo batch.
- Botón "Ir a pagar" del `CartDrawer` conectado vía hook + service.
- Páginas `/checkout/success` y `/checkout/cancel` (solo lectura, no marcan pagos).

No incluye (specs futuros):
- Historial/detalle de pedidos del cliente (`/account`, `/orders`).
- Panel `/admin/orders` (listado, cambio manual de estado, TanStack Table).
- Sincronizar `products` con `Product`/`Price` de Stripe (descartado, `docs/stripe/README.md` §1).
- Suscripciones, Stripe Tax, Connect.
- Tablas `carts`/`cart_items`: el carrito sigue 100% cliente (Zustand).

## Criterios de aceptación
- [ ] AC1 — Dado un carrito con productos activos y con stock, cuando el usuario pulsa "Ir a pagar", entonces el navegador va a `session.url` de Stripe.
- [ ] AC2 — Dado un cliente que manipula el `priceCents` del localStorage, cuando crea la sesión, entonces Stripe cobra el `products.price_cents` de la BD (el body solo lleva `productId` y `quantity`).
- [ ] AC3 — Dado un producto inactivo, borrado o con stock insuficiente, cuando se crea la sesión, entonces responde 409 con el nombre del producto y no crea orden ni sesión.
- [ ] AC4 — Dado un usuario anónimo, cuando llama al endpoint, entonces responde 401.
- [ ] AC5 — Dado un pago completado, cuando llega `checkout.session.completed`, entonces la orden pasa a `paid`, se descuenta el stock de cada línea y se inserta un `audit_logs` `order.paid` en el mismo batch.
- [ ] AC6 — Dado el mismo evento entregado dos veces (reintento de Stripe), cuando se procesa, entonces el stock se descuenta una sola vez y la respuesta sigue siendo 200.
- [ ] AC7 — Dado un webhook con firma inválida o ausente, cuando llega, entonces responde 400 sin tocar la BD.
- [ ] AC8 — Dado `checkout.session.async_payment_failed`, cuando llega, entonces la orden pasa a `failed` y el stock no se toca.
- [ ] AC9 — Dado `/checkout/success?session_id=…`, cuando la orden aún está `pending`, entonces muestra "confirmando el pago" y no muta nada.

## Datos
Requiere migración (`db:generate` + `db:migrate`). Enum nuevo `order_status`.

`orders` — `id` uuid PK · `user_id` uuid FK `users.id` notNull · `status` `order_status`
(`pending|paid|failed|canceled`) notNull default `pending` · `total_cents` integer notNull
(check `>= 0`) · `currency` varchar(3) notNull default `'eur'` · `stripe_checkout_session_id`
varchar(255) notNull unique · `stripe_payment_intent_id` varchar(255) nullable ·
`created_at`/`updated_at` timestamptz (`$onUpdate`). Índice `(user_id, created_at desc)`.

`order_items` — `id` uuid PK · `order_id` uuid FK `orders.id` `onDelete: cascade` notNull ·
`product_id` uuid FK `products.id` `onDelete: restrict` notNull · `product_name` varchar(140)
notNull · `unit_price_cents` integer notNull (snapshot, nunca se relee) · `quantity` integer
notNull (check `> 0`). Índice `(order_id)`.

Tipos con `InferSelectModel`/`InferInsertModel`; ambas tablas exportadas desde el barrel
`src/server/db/schema/index.ts`.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/checkout/session` | Clerk (sesión, sin `permission.code`: es autoservicio) | `{ items: [{ productId, quantity }] }` | 200 `{ url, orderId }` · 400 Zod · 401 · 409 `{ error, productName }` · 500 |
| POST | `/api/webhooks/stripe` | firma `stripe-signature` (pública en `proxy.ts`) | raw body de Stripe | 200 vacío · 400 firma inválida · 404 orden no encontrada (fuerza reintento) |

Zod (`checkoutSessionSchema`): `items` array min 1 max 50 de `{ productId: uuid, quantity: int
1..99 }`, sin `productId` repetido.

## Reutilizar
- `src/lib/auth.ts` — `getCurrentUserState()` para el 401 y el `users.id` de `orders.user_id`.
- `src/lib/audit.ts` — `buildAuditLogInsert()` + `getRequestAuditContext()`; añadir las acciones nuevas a `AUDIT_ACTIONS`.
- `src/server/db/batch.ts` — `runBatch()`/`PgStatement`: `neon-http` no soporta `db.transaction()`, la atomicidad de CLAUDE.md §4.9 se logra con `db.batch()`.
- `src/server/repositories/product.repository.ts` — `findById()` para revalidar precio/stock; ahí mismo va la sentencia de descuento de stock.
- `src/modules/cart/store/cart.store.ts` — `lines` (ya trae `productId` y `quantity`) y `clear()`.
- `src/modules/products/constants.ts` — `formatPrice()` (EUR, `es-ES`) en las páginas de resultado.
- `src/lib/axios.ts` — instancia `api`; patrón de service en `src/modules/storefront/services/catalog.service.ts` y de hook de mutación en `src/modules/products/hooks/use-product-mutations.ts` (incluye `getApiErrorMessage`).
- `src/proxy.ts` — `/api/webhooks(.*)` ya es público: no se toca.
- `.env.example` — `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` ya declaradas.
- Componentes shadcn: todo lo necesario (`button`, `sheet`, `card`, `separator`, `sonner`) ya está instalado.

## Tareas
- [x] T1 — `npm i stripe` y cliente instancia server-only (`new Stripe(key, { apiVersion: "2026-08-26.dahlia" })`) · `src/lib/stripe.ts`
- [x] T2 — Enum + tabla `orders` con tipos inferidos · `src/server/db/schema/order.ts`
- [x] T3 — Tabla `order_items` + export en el barrel · `src/server/db/schema/order-item.ts`
- [x] T4 — Generar y aplicar migración (`npm run db:generate && npm run db:migrate`) · `drizzle/`
- [x] T5 — Repositorio: `createWithItems`, `findByStripeCheckoutSessionId`, `findWithItems`, y builders `buildMarkPaid`/`buildMarkFailed` (devuelven `PgStatement`) · `src/server/repositories/order.repository.ts`
- [x] T6 — Builder `buildStockDecrement(productId, quantity, orderId)` guardado por `exists(order pending)` · `src/server/repositories/product.repository.ts`
- [x] T7 — Acciones `ORDER_PAID: "order.paid"` y `ORDER_PAYMENT_FAILED: "order.payment_failed"` · `src/lib/audit.ts`
- [x] T8 — Schema Zod del body · `src/modules/checkout/schemas/checkout.schema.ts`
- [x] T9 — Servicio de servidor: revalida líneas contra BD, arma `line_items[].price_data` (sin `payment_method_types`), crea la Checkout Session y persiste la orden `pending` · `src/server/services/checkout.service.ts`
- [x] T10 — Servicio de fulfillment idempotente (`fulfillCheckout`, `markOrderFailed`) en un solo `runBatch` con el audit log · `src/server/services/order-fulfillment.service.ts`
- [x] T11 — Route Handler: 401 + Zod + delega en el servicio · `src/app/api/checkout/session/route.ts`
- [x] T12 — Route Handler del webhook: `req.text()` + `constructEvent`, switch de los 3 eventos · `src/app/api/webhooks/stripe/route.ts`
- [x] T13 — Service axios `createCheckoutSession()` + `getApiErrorMessage` · `src/modules/checkout/services/checkout.service.ts`
- [x] T14 — Hook `useCreateCheckoutSession` (mutación, toast de error) · `src/modules/checkout/hooks/use-create-checkout-session.ts`
- [x] T15 — Habilitar el botón "Ir a pagar": estado `isPending`, redirige con `window.location.assign(url)` · `src/modules/cart/components/cart-drawer.tsx`
- [x] T16 — Página de éxito (Server Component: lee la orden por `session_id`, valida dueño, resumen) · `src/app/(storefront)/checkout/success/page.tsx`
- [x] T17 — Componente cliente que vacía el carrito al confirmarse la compra · `src/modules/checkout/components/clear-cart-on-success.tsx`
- [x] T18 — Página de cancelación con vuelta al catálogo · `src/app/(storefront)/checkout/cancel/page.tsx`

Verificación final: `npm run typecheck && npm run lint`

## Notas
- **Orden de creación.** `stripe_checkout_session_id` es notNull y `client_reference_id` necesita el id de la orden: se genera el uuid en la app (`crypto.randomUUID()`), se crea la sesión en Stripe y luego se insertan orden + items en un `batch`. Si el insert falla, la sesión huérfana expira sola a las 24 h.
- **Idempotencia.** Pre-chequeo de `status === "pending"` **y** guarda SQL en cada sentencia (`where status = 'pending'` / `exists (…)`); solo con el pre-chequeo, dos entregas simultáneas descontarían stock dos veces.
- **Oversell.** El descuento usa `greatest(stock - quantity, 0)`: una resta directa violaría el check `products_stock_non_negative` y haría fallar el batch en bucle con los reintentos de Stripe. La diferencia se anota en `metadata` del audit log.
- **Carrera webhook/insert.** Si el webhook llega antes de que la orden exista, responder 404 (no 200) para que Stripe reintente.
- **Sin PII.** El audit log guarda `orderId`, `totalCents` y los ids de Stripe; nunca email, dirección ni datos de tarjeta.
- **`apiVersion`.** El SDK publicado (`stripe@22.6.1`) tipa `apiVersion` como el literal de su propia versión pineada (`LatestApiVersion`), así que `2026-07-29.dahlia` —el valor con el que se redactó T1— no compila. Se fija `2026-08-26.dahlia`.
- **`getApiErrorMessage`.** El helper se extrae a `src/lib/api-error.ts` en vez de copiarse otra vez en el service del módulo: ya existían cinco copias idénticas y CLAUDE.md §6 fija el umbral en la tercera. Las cinco previas se dejan intactas, migrarlas es deuda ajena a este spec.
