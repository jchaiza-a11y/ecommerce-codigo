---
id: 010
title: Mis tarjetas — guardar métodos de pago y pagar con ellos
status: done
module: profile
scope: client
---

# 010 — Mis tarjetas — guardar métodos de pago y pagar con ellos

## Objetivo
Un cliente autenticado guarda, lista y elimina sus tarjetas en `/account` › "Mis tarjetas", y paga sus compras con una de ellas sin volver a teclear el número.

## Decisiones que corrigen el pedido literal (confirmar al aprobar)
1. **Los "4 primeros dígitos" no existen como dato.** Por PCI-DSS Stripe nunca devuelve el BIN/IIN; de
   `payment_method.card` solo expone `brand`, `last4`, `exp_month`, `exp_year`, `funding`. La empresa
   sale de `brand`, no del prefijo: se guarda `brand + last4` → `Visa •••• 4242`.
2. **Setup mode, no un cobro de 0 €.** El "link de Stripe" es una Checkout Session `mode: "setup"`
   (SetupIntent por debajo) sobre un Stripe Customer: misma página hospedada que 008, sin cargo.
3. **Pagar con guardada = Checkout hospedado con `customer`.** Verificado en `stripe docs
   /payments/existing-customers?ui=stripe-hosted` y en `POST /v1/checkout/sessions`: con `customer`,
   Checkout lista hasta 50 tarjetas guardadas y **prellena la más reciente**; los únicos mandos son
   `saved_payment_method_options.allow_redisplay_filters` y `payment_method_remove`. **No hay
   parámetro para fijar cuál viene preseleccionada**: el selector propio decide *si* se ofrecen las
   guardadas y la elección final se confirma en Stripe. Descartado el PaymentIntent con `confirm:
   true` + `payment_method`: fija la tarjeta, pero obliga a gestionar `next_action`/3DS con Stripe.js,
   pierde los métodos dinámicos y duplica el cumplimiento del webhook de 008.

## Alcance
Incluye: pestaña "Mis tarjetas" en `/account` (listar, agregar, eliminar) · `users.stripe_customer_id`
y tabla `payment_methods` · rama `mode === "setup"` en el webhook · selector de tarjeta en el checkout.

No incluye:
- One-click sin pasar por la página de Stripe, pagos off-session, tarjeta por defecto persistida,
  guardar la tarjeta *durante* un pago (`setup_future_usage`) y editar una tarjeta ya guardada.
- `audit_logs` (es autoservicio del cliente, no una acción de panel) · `@stripe/stripe-js`,
  Payment Element o cualquier formulario de tarjeta propio.

## Criterios de aceptación
- [ ] AC1 — Dado un usuario sin tarjetas, cuando abre "Mis tarjetas", entonces ve el estado vacío con el botón "Agregar tarjeta"; durante la carga hay skeletons y ante un fallo de red, mensaje y botón "Reintentar".
- [ ] AC2 — Dado que pulsa "Agregar tarjeta", cuando la API responde, entonces se redirige a la url hospedada de Stripe; si allí cancela, vuelve sin guardar nada y sin error.
- [ ] AC3 — Dado que completa el formulario en Stripe, cuando vuelve a `/account?tab=cards&setup=success&session_id=…`, entonces la tarjeta aparece con marca, `•••• last4` y caducidad `MM/AAAA`, y la url queda limpia.
- [ ] AC4 — Dado que cierra la pestaña sin volver, cuando llega `checkout.session.completed` de esa sesión, entonces la tarjeta queda guardada igual.
- [ ] AC5 — Dada la misma sesión confirmada dos veces (retorno + webhook), entonces existe una sola fila en `payment_methods`.
- [ ] AC6 — Dado que elimina una tarjeta y confirma en el `AlertDialog`, entonces desaparece de la lista y queda `detach`ada en Stripe.
- [ ] AC7 — Dado el `id` de una tarjeta de otro usuario, cuando intenta borrarla, entonces responde 404 y la fila ajena no se toca.
- [ ] AC8 — Dado un usuario anónimo, sin fila en `users` o inactivo, cuando llama a cualquier endpoint de tarjetas, entonces responde 401/403 con el mismo contrato que `/api/checkout/session`.
- [ ] AC9 — Dado un usuario con tarjetas guardadas, cuando abre el carrito, entonces ve un selector con `Marca •••• last4` por tarjeta y la opción "Usar otra tarjeta", con la más reciente marcada; un usuario anónimo no ve el selector ni dispara la consulta.
- [ ] AC10 — Dado que paga con una guardada, cuando llega a Stripe, entonces sus tarjetas aparecen listadas y la más reciente prellenada; al confirmar, el pedido se cumple por el webhook de 008 sin cambios.
- [ ] AC11 — Dado que elige "Usar otra tarjeta", cuando llega a Stripe, entonces no se le muestran las guardadas y debe introducir una nueva.
- [ ] AC12 — Dado un `savedCardId` que no pertenece al usuario, cuando pide la sesión de pago, entonces responde 404 y no se crea ni sesión ni pedido.

## Datos
Requiere migración (`npm run db:generate && npm run db:migrate`).

`users` · columna nueva `stripe_customer_id` `varchar(255)` nullable + `uniqueIndex` (el Customer se crea con la primera tarjeta o compra, no en el alta).

`payment_methods` (nueva) · `src/server/db/schema/payment-method.ts`:
- `id` uuid pk defaultRandom · `user_id` uuid notNull → `users.id` · `stripe_payment_method_id` varchar(255) notNull **unique** (es lo que hace idempotente AC5)
- `brand` varchar(32) notNull · `last4` varchar(4) notNull · `exp_month` / `exp_year` integer notNull · `created_at` / `updated_at` timestamptz notNull defaultNow · `index` por `user_id` · `check` `exp_month BETWEEN 1 AND 12`

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/profile/payment-methods` | Clerk (sesión, autoservicio: sin `permission.code`) | — | 200 `{ items: SavedCard[] }` · 401 · 403 · 500 |
| POST | `/api/profile/payment-methods/setup-session` | Clerk | `{}` | 200 `{ url }` · 401 · 403 · 500 |
| POST | `/api/profile/payment-methods` | Clerk | `{ setupSessionId }` | 201 `{ item: SavedCard }` · 400 · 401 · 403 · 404 |
| DELETE | `/api/profile/payment-methods/[id]` | Clerk | — | 204 · 400 · 401 · 403 · 404 · 502 |
| POST | `/api/checkout/session` (existente) | Clerk | `{ items, savedCardId? }` | 200 `{ url, orderId }` · 400 · 401 · 403 · 404 · 409 |

Zod en `src/modules/profile/schemas/saved-card.schema.ts`: `confirmSetupSchema` (`setupSessionId: z.string().startsWith("cs_")`) · `savedCardIdSchema` (`z.uuid()` para el `params.id` del DELETE, que en Next 16 llega como `Promise`) · `setup-session` no lleva datos: valida el body opcional con `z.object({}).strict()` (regla 4).
`SavedCard` = `{ id, brand, last4, expMonth, expYear, createdAt }`; nunca se serializan al cliente `stripe_payment_method_id` ni `stripe_customer_id`. `checkout.schema.ts` suma `savedCardId: z.uuid().optional()`: ausente = tarjeta nueva (`allow_redisplay_filters: ["limited"]`, que oculta las guardadas); presente y propia del usuario = ofrecer las guardadas (`["always"]`).

## Reutilizar
- `src/lib/stripe.ts` — cliente único: `checkout.sessions.create({ mode: "setup", customer, … })`, `checkout.sessions.retrieve(id, { expand: ["setup_intent.payment_method"] })`, `paymentMethods.update(pm, { allow_redisplay: "always" })` (el default es `unspecified` y Checkout no mostraría la tarjeta), `paymentMethods.detach(pm)`.
- `src/app/api/checkout/session/route.ts` — bloque 401/403/`isActive` de autoservicio: cópialo tal cual (AC8); es también el handler que cambia en T20. Su servicio `src/server/services/checkout.service.ts` aporta el patrón de servidor y `getAppUrl()` (T4 lo extrae, no lo dupliques), y hoy manda `customer_email`, incompatible con `customer`: se sustituye, no se suman los dos.
- `src/lib/auth.ts` (`getCurrentUserState`) · `src/lib/axios.ts` (`api`) · `src/lib/api-error.ts` · `src/server/repositories/order.repository.ts` (patrón de repositorio y `onConflictDoUpdate`).
- `src/modules/profile/`: `services/order-history.service.ts`, `hooks/use-order-history.ts` y `constants.ts` como patrón de service/hook/query keys; `components/account-empty-section.tsx` (AC1) y `account-tabs.tsx` (punto de montaje, ya `"use client"`).
- `src/modules/cart/components/cart-drawer.tsx` — único consumidor de `useCreateCheckoutSession`: ahí se monta el selector, con `useAuth().isSignedIn` gobernando el `enabled` de la query (AC9).
- shadcn instalados y suficientes: `card`, `button`, `alert-dialog`, `skeleton`, `empty`, `badge`, `tabs`, `select`, `sonner` — no instalar nada. Iconos: `CreditCard`, `Plus`, `Trash2`.

## Tareas
- [x] T1 — Tabla `payment_methods`, columna `stripe_customer_id`, export en el barrel y migración generada y aplicada · `src/server/db/schema/payment-method.ts`, `user.ts`, `index.ts`, `drizzle/`
- [x] T2 — Repositorio: `listByUserId`, `upsertByStripeId`, `findByIdAndUserId`, `deleteById` · `src/server/repositories/payment-method.repository.ts`
- [x] T3 — `attachStripeCustomerId(userId, customerId)` con `where stripe_customer_id IS NULL` y `returning` · `src/server/repositories/user.repository.ts`
- [x] T4 — Extraer `getAppUrl()` y consumirlo desde el checkout · `src/lib/app-url.ts`, `src/server/services/checkout.service.ts`
- [x] T5 — Servicio: `ensureStripeCustomer(user)` + `createSetupSession(user)` con `success_url`/`cancel_url` a `/account?tab=cards` · `src/server/services/saved-card.service.ts`
- [x] T6 — Servicio: `savePaymentMethodFromSetupSession(session, userId)` (fuerza `allow_redisplay: "always"`) + `removeSavedCard(userId, id)` con detach previo · `src/server/services/saved-card.service.ts`
- [x] T7 — Schemas Zod y tipo `SavedCard` · `src/modules/profile/schemas/saved-card.schema.ts`
- [x] T8 — Route Handler `GET` (listado) y `POST` (confirmar sesión) · `src/app/api/profile/payment-methods/route.ts`
- [x] T9 — Route Handler de la sesión de setup · `src/app/api/profile/payment-methods/setup-session/route.ts`
- [x] T10 — Route Handler `DELETE` · `src/app/api/profile/payment-methods/[id]/route.ts`
- [x] T11 — Rama `session.mode === "setup"` antes de `fulfillCheckout` · `src/app/api/webhooks/stripe/route.ts`
- [x] T12 — Service axios: `getSavedCards`, `createCardSetupSession`, `confirmSavedCard`, `deleteSavedCard` · `src/modules/profile/services/saved-card.service.ts`
- [x] T13 — `savedCardKeys` + `CARD_BRAND_LABELS` + `formatCardExpiry()` · `src/modules/profile/constants.ts`
- [x] T14 — Hooks `useSavedCards()` y `useSavedCardMutations()` · `src/modules/profile/hooks/use-saved-cards.ts`, `use-saved-card-mutations.ts`
- [x] T15 — Tarjeta presentacional + `AlertDialog` de borrado · `src/modules/profile/components/saved-card-item.tsx`
- [x] T16 — Sección `"use client"`: lista, skeleton/error/vacío, botón "Agregar" y confirmación del retorno (`session_id` → `POST` → `router.replace("/account?tab=cards")`) · `src/modules/profile/components/saved-cards-section.tsx`
- [x] T17 — Pestaña "Mis tarjetas" con `defaultTab` y `searchParams.tab` (`Promise` en Next 16) · `src/modules/profile/components/account-tabs.tsx`, `src/app/(storefront)/account/page.tsx`
- [x] T18 — `savedCardId: z.uuid().optional()` en `checkoutSessionSchema` · `src/modules/checkout/schemas/checkout.schema.ts`
- [x] T19 — Sesión de pago con `ensureStripeCustomer` + `customer` (fuera `customer_email`) + `allow_redisplay_filters` según la elección · `src/server/services/checkout.service.ts`
- [x] T20 — Handler de pago: resolver `savedCardId` con `findByIdAndUserId` y responder 404 si es ajena, antes de tocar Stripe · `src/app/api/checkout/session/route.ts`
- [x] T21 — `savedCardId` opcional en el service y el hook del checkout · `src/modules/checkout/services/checkout.service.ts`, `hooks/use-create-checkout-session.ts`
- [x] T22 — `SavedCardPicker` presentacional: opción por tarjeta (`Marca •••• last4`) + "Usar otra tarjeta" · `src/modules/checkout/components/saved-card-picker.tsx`
- [x] T23 — Montar el picker en el drawer (solo con sesión) y enviar la selección al mutate · `src/modules/cart/components/cart-drawer.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- **Webhook en bucle (bloqueante).** Hoy todo `checkout.session.completed` cae en `fulfillCheckout`,
  que busca la sesión en `orders`; una `mode: "setup"` no tiene pedido y devolvería `order_not_found`
  → 404 → Stripe reintenta 3 días. T11 no es opcional.
- **Doble escritura.** El retorno del usuario y el webhook guardan la misma tarjeta a la vez: la
  idempotencia sale del unique + `onConflictDoUpdate`, no de un "comprobar y luego insertar".
- **Customer duplicado.** T3 actualiza solo si `stripe_customer_id IS NULL`; con `returning` vacío se
  relee la fila y se usa el Customer ya persistido (el sobrante queda huérfano en Stripe, sin coste).
- **Detach ≠ delete.** Stripe desasocia el PaymentMethod, no lo borra; si el `detach` falla, la fila
  local **no** se borra (una tarjeta invisible pero aún adjunta al Customer es peor que un error).
- **El prellenado caduca a los 30 min** y, con varias tarjetas, Stripe prellena la más nueva, no la
  elegida (decisión 3): la UI ofrece la tarjeta, no promete "se cobrará esta".
