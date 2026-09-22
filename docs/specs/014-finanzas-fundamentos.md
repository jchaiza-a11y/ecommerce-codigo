---
id: 014
title: Finanzas — fundamentos (costo de producto, ledger automático, permisos)
status: done
module: finance
scope: admin
---

# 014 — Finanzas — fundamentos (costo de producto, ledger automático, permisos)

## Contexto
011 ya reservó el número 014 para Finanzas (§Alcance "No incluye"). El módulo nace de una
sesión de brainstorming con el usuario (sin agentes), aterrizada en
`docs/superpowers/` no aplica aquí — el insumo es la conversación previa, ya aprobada. Este
es el primer spec de una serie de 3: este pone el modelo de datos, el ledger automático y
los permisos; specs futuros construyen las páginas (`/admin/finance/*`) sobre esta base.

## Objetivo
Cuando un pedido pasa a `paid`, el sistema registra automáticamente su ingreso y sus
egresos (costo de mercadería + envío) en el ledger de Finanzas, sin intervención manual.

## Alcance
Incluye:
- `products.cost_cents` (integer, nullable) — costo manual por producto.
- Tablas nuevas `finance_income`, `finance_expense`, `finance_settings`.
- `fulfillCheckout` (008) crea, en el mismo `batch`, 1 fila de ingreso + hasta 2 de egreso
  (COGS agregado + envío) por cada pedido que pasa a `paid`.
- Permisos `finance.view` / `finance.manage`, sembrados y mapeados en `proxy.ts`.
- `PATCH /api/admin/finance/products/:id/cost` y `GET`/`PATCH /api/admin/finance/settings`.

No incluye:
- Páginas de UI (`/admin/finance/*`) — specs futuros (resumen/ingresos/egresos, margen).
- CRUD de filas `manual` de ingreso/egreso — spec futuro; aquí solo existen la tabla y el
  origen `order*` (automático, no editable).
- Costeo por lote, comisiones de pasarela, envío real por pedido, declaración de IGV,
  estado `refunded` — fuera de alcance v1.

## Criterios de aceptación
- [x] AC1 — Dado un pedido que pasa a `paid`, entonces se crea 1 fila `finance_income`
  (origen `order`, `amount_cents = total_cents`) en el mismo batch del fulfillment.
- [x] AC2 — Dado un pedido pagado con líneas cuyo producto tiene `cost_cents`, entonces se
  crea 1 fila `finance_expense` (`order_cogs`) con la suma costo×cantidad de esas líneas;
  las líneas sin costo no aportan a ese monto y quedan contadas en `metadata`.
- [x] AC3 — Dado un pedido pagado, entonces se crea 1 fila `finance_expense`
  (`order_shipping`) con la tarifa vigente de `finance_settings.shipping_cost_cents`.
- [x] AC4 — Dado un reintento del webhook de Stripe sobre un pedido ya fulfillado, entonces
  no se duplican filas de `finance_income`/`finance_expense`.
- [x] AC5 — Dado un usuario sin `finance.manage`, los `PATCH` responden 403; sin
  `finance.view`, `proxy.ts` corta `/api/admin/finance/*` antes del handler.
- [x] AC6 — Dado un `PATCH` válido de costo o tarifa de envío, se audita en `audit_logs` en
  la misma transacción, sin PII.
- [x] AC7 — Dado un `cost_cents` o `shipping_cost_cents` negativo o no entero, Zod rechaza
  con 400 antes de tocar la base.

## Datos
Requiere migración:

| Tabla | Columna | Tipo | Constraint |
|---|---|---|---|
| `products` | `cost_cents` | `integer` | nullable, check `>= 0` |
| `finance_income` (nueva) | `id` | `uuid` pk | default random |
| | `origin` | enum `finance_income_origin` (`order`,`manual`) | not null |
| | `amount_cents` | `integer` | not null, check `>= 0` |
| | `description` | `varchar(200)` | nullable |
| | `occurred_at` | `timestamptz` | not null, default now |
| | `order_id` | `uuid` FK `orders.id` restrict | nullable |
| | `category` | enum `finance_income_category` (`venta_extra`,`financiero`,`otro`) | nullable |
| | `created_by` | `uuid` FK `users.id` set null | nullable |
| | `created_at` | `timestamptz` | not null, default now |
| `finance_expense` (nueva) | `id` | `uuid` pk | default random |
| | `origin` | enum `finance_expense_origin` (`order_cogs`,`order_shipping`,`manual`) | not null |
| | `amount_cents` | `integer` | not null, check `>= 0` |
| | `description` | `varchar(200)` | nullable |
| | `occurred_at` | `timestamptz` | not null, default now |
| | `order_id` | `uuid` FK `orders.id` restrict | nullable |
| | `category` | enum `finance_expense_category` (`alquiler`,`servicios`,`marketing`,`personal`,`otro`) | nullable |
| | `metadata` | `jsonb` | nullable (solo `order_cogs`: `{itemsWithCost, itemsWithoutCost, excludedSalesCents}`) |
| | `created_by` | `uuid` FK `users.id` set null | nullable |
| | `created_at` | `timestamptz` | not null, default now |
| `finance_settings` (nueva) | `id` | `smallint` pk | check `id = 1` (singleton) |
| | `shipping_cost_cents` | `integer` | not null, default 0, check `>= 0` |
| | `updated_at` | `timestamptz` | not null, default now, `$onUpdate` |

Checks de coherencia por origen (CHECK, no confiar solo en Zod):
- `finance_income`: `(origin='order' and order_id is not null and category is null) or (origin='manual' and order_id is null and category is not null)`.
- `finance_expense`: `(origin in ('order_cogs','order_shipping') and order_id is not null and category is null) or (origin='manual' and order_id is null and category is not null)`.

Índices únicos parciales (idempotencia del webhook, AC4):
- `finance_income_order_unique` on `(order_id)` where `origin = 'order'`.
- `finance_expense_order_origin_unique` on `(order_id, origin)` where `origin in ('order_cogs','order_shipping')`.

Seed: insertar la fila singleton de `finance_settings` (`id=1, shipping_cost_cents=0`) como
parte de la migración (dato de sistema, no de RBAC — no va en `seed.ts`).

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/settings` | `requirePermission("finance.view")` | — | 200 `{shippingCostCents}` |
| PATCH | `/api/admin/finance/settings` | `requirePermission("finance.manage")` | `{shippingCostCents: int>=0}` | 200 `{shippingCostCents}` · 400 · 403 |
| PATCH | `/api/admin/finance/products/:id/cost` | `requirePermission("finance.manage")` | `{costCents: int>=0}` | 200 `{id, costCents}` · 400 · 403 · 404 |

Zod: `updateSettingsSchema = z.object({ shippingCostCents: z.number().int().min(0) })`;
`updateProductCostSchema = z.object({ costCents: z.number().int().min(0) })`.

## Reutilizar
- `src/server/services/order-fulfillment.service.ts` — `fulfillCheckout` ya arma el `batch`
  con `PgStatement[]`; se amplía ahí, no se crea un flujo paralelo. `findOversoldLines` ya
  trae los `product` completos por línea — reusar ese fetch (ya incluye `costCents`) en vez
  de una query nueva.
- `src/server/db/batch.ts` (`runBatch`, `PgStatement`) — mismo patrón de atomicidad.
- `src/lib/audit.ts` (`buildAuditLogInsert`, `AUDIT_ACTIONS`) — agregar
  `FINANCE_SETTINGS_UPDATED: "finance.settings_updated"` y
  `FINANCE_PRODUCT_COST_UPDATED: "finance.product_cost_updated"`.
- `src/lib/permissions.ts` (`PERMISSIONS`, `requirePermission`) — agregar
  `FINANCE_VIEW: "finance.view"`, `FINANCE_MANAGE: "finance.manage"`.
- `src/lib/route-permissions.ts` — agregar `{prefix: "/admin/finance", permission: "finance.view"}`
  y `{prefix: "/api/admin/finance", permission: "finance.view"}` a `ADMIN_ROUTE_PERMISSIONS`
  (antes de `/admin`), y una entrada en `ADMIN_SECTION_FALLBACKS`.
- `src/server/db/seed.ts` — agregar `finance.view`/`finance.manage` a `PERMISSION_CATALOG` y a
  `ROLE_PERMISSION_MATRIX`: `admin` recibe ambos, `manager` solo `finance.view` (mismo patrón
  que `products.view` sin `products.create/delete`), `audit`/`employee`/`customer` ninguno.
- `src/server/repositories/product.repository.ts` (`update`) — sirve tal cual para
  `costCents` una vez esté en `NewProduct`; no se toca la función.
- `src/app/api/admin/metrics/route.ts` — patrón exacto de Route Handler admin a replicar en
  los dos endpoints nuevos.

## Tareas
- [x] T1 — Columna `cost_cents` (nullable, check `>= 0`) · `src/server/db/schema/product.ts`
- [x] T2 — Schema `finance_income` con enums, checks e índice único parcial ·
  `src/server/db/schema/finance-income.ts`
- [x] T3 — Schema `finance_expense` con enums, checks e índice único parcial ·
  `src/server/db/schema/finance-expense.ts`
- [x] T4 — Schema `finance_settings` (singleton) · `src/server/db/schema/finance-settings.ts`
- [x] T5 — Export de las 4 tablas nuevas · `src/server/db/schema/index.ts`
- [x] T6 — Generar migración + seed manual de la fila singleton (`id=1`) ·
  `npm run db:generate` (`drizzle/0006_freezing_goblin_queen.sql`)
- [x] T7 — `financeRepository`: `getSettings()`, `buildUpdateSettings()`,
  `buildIncomeInsert(order)`, `buildCogsInsert(order, items)`, `buildShippingInsert(order,
  shippingCostCents)` (los tres `build*` con `.onConflictDoNothing()`) ·
  `src/server/repositories/finance.repository.ts`
- [x] T8 — Tests del repositorio con `mockDbQuery()` ·
  `src/server/repositories/finance.repository.test.ts`
- [x] T9 — `fulfillCheckout` agrega los 3 statements al `batch` existente, leyendo
  `finance_settings` antes de construirlo · `src/server/services/order-fulfillment.service.ts`
- [x] T10 — Test del servicio: pedido con líneas sin costo no infla COGS y queda en
  `metadata`; reintento no duplica filas ·
  `src/server/services/order-fulfillment.service.test.ts`
- [x] T11 — Permisos `finance.view`/`finance.manage` · `src/lib/permissions.ts`
- [x] T12 — Entradas en `route-permissions.ts` (rutas + fallback) ·
  `src/lib/route-permissions.ts`
- [x] T13 — Seed de permisos y matriz de roles · `src/server/db/seed.ts`
- [x] T14 — `AUDIT_ACTIONS` nuevos · `src/lib/audit.ts`
- [x] T15 — `GET`/`PATCH /api/admin/finance/settings` (Zod, guard, audit) ·
  `src/app/api/admin/finance/settings/route.ts`
- [x] T16 — `PATCH /api/admin/finance/products/[id]/cost` (Zod, guard, audit) ·
  `src/app/api/admin/finance/products/[id]/cost/route.ts`

Verificación final: `npm run typecheck && npm run lint && npm run test` (el `build` lo corre
el reviewer)

## Notas
- **Idempotencia (AC4).** El pre-chequeo de `existing.status !== "pending"` en
  `fulfillCheckout` cubre el reintento normal, pero no una carrera de dos entregas
  simultáneas del mismo evento. A diferencia de `buildStockDecrement` (update idempotente por
  guarda SQL), aquí son `INSERT`s nuevos: la defensa es el índice único parcial +
  `.onConflictDoNothing()`, no una guarda de `where`.
- **COGS agregado, no por línea.** Se decidió 1 fila `order_cogs` por pedido (suma), no una
  por `order_item`: la vista de margen por producto (spec futuro) lee `cost_cents` ×
  `order_items` directo, no depende de esta fila. Menos filas, mismo dato disponible.
- **Sin auditoría propia para las filas automáticas.** `ORDER_PAID` (008) ya audita el pago
  con `totalCents`; las filas de ledger son 100% derivadas y trazables por `order_id`, así
  que no duplican entrada en `audit_logs`. Los dos `PATCH` sí auditan: son mutaciones
  manuales genuinas.
- **Categorías de ingreso manual.** No hubo una decisión explícita del usuario sobre esto (sí
  la hubo para egresos: lista fija). Se fija un enum mínimo (`venta_extra`, `financiero`,
  `otro`) para no dejar la columna sin tipo; el spec de CRUD de ingresos puede ampliarlo si
  hace falta — es un `ALTER TYPE ... ADD VALUE`, cambio barato.
- **`manager` sin `finance.manage`.** Criterio propio, no confirmado con el usuario: sigue el
  patrón ya usado con `products.view` sin `products.create/delete`. Ajustable en review.

## Notas de implementación
Decisiones tomadas al ejecutar, para revisión:

- **`productRepository.buildUpdate()` nuevo.** `update()` ejecuta al vuelo y no puede entrar
  en el `batch` del `audit_logs`, que AC6 exige. Se añadió el hermano sin ejecutar (mismo
  patrón que `userRepository.buildUpdate`) y `update()` quedó intacto, como pedía §Reutilizar.
- **Dos filas de egreso siempre, no "hasta 2".** AC2 y AC3 son incondicionales y la metadata
  del COGS solo existe si la fila existe, así que un pedido pagado genera exactamente 3 filas
  de ledger. El monto puede ser 0 (pedido sin productos costeados, o tarifa de envío en 0);
  "hasta 2" de §Alcance queda como cota superior.
- **`summarizeCogs()` exportada del repositorio.** El reparto costeado/sin costear es una
  función pura y probada aparte; `buildCogsInsert(order, lines)` la usa para no obligar al
  servicio a conocer la forma de `metadata`.
- **Producto ilegible = línea sin costo.** Si `findById` no devuelve el producto (retirado con
  soft delete), la línea cuenta como `itemsWithoutCost`, no como costo 0.
- **Zod en `src/modules/finance/schemas/finance.schema.ts`** (+ su test), por convención de
  `docs/SETUP.md §3`. Usa `z.int()`, no `z.number()`: rechaza decimales, no solo negativos.
- **`PERMISSION_LABELS` ampliado.** `src/modules/roles/constants/permission-labels.ts` está
  tipado por `Record<PermissionCode, string>`: sin las dos etiquetas nuevas no compila.
- **Pendiente del siguiente spec.** La entrada de `ADMIN_SECTION_FALLBACKS` apunta a
  `/admin/finance`, que todavía no existe. Es la última de la lista y ningún rol sembrado
  tiene `finance.view` sin `dashboard.view`, así que hoy es inalcanzable; se activa cuando
  lleguen las páginas.
- **Entorno.** El worktree no traía `node_modules` (9 tests fallaban al resolver
  `server-only`) y `tsc` necesita los tipos de ruta de Next 16. Se resolvió con
  `npm install` y `npx next typegen`; ningún archivo de producto lo requería.
