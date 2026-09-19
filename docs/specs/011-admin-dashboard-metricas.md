---
id: 011
title: Dashboard de administración — métricas en vivo (últimos 30 días)
status: done
module: dashboard
scope: admin
---

# 011 — Dashboard de administración — métricas en vivo (últimos 30 días)

## Contexto
`/admin` es la única entrada del panel que hoy no existe: `admin-sidebar.tsx` ya enlaza
"Dashboard" a `/admin` y `proxy.ts` ya exige `dashboard.view` en esa ruta (003 §8.7), pero
no hay `page.tsx` y la navegación cae en 404. 003 §11 lo dejó como deuda explícita.
`src/app/api/admin/metrics/` existe vacía y `docs/SETUP.md` §6 la reserva para esto.

## Objetivo
Un administrador con `dashboard.view` abre `/admin` y ve, sin recargar, los KPIs de venta
de los últimos 30 días, la evolución diaria, los productos más vendidos y el stock bajo.

## Alcance
Incluye:
- Columna `products.low_stock_threshold` (migración) como umbral por producto.
- `GET /api/admin/metrics` — un único endpoint con el payload combinado.
- 4 KPIs (30 días): ventas, pedidos, ticket promedio, productos con stock bajo.
- Gráfico de línea ventas/pedidos por día (30 puntos, sin huecos) y barras horizontales
  de top 10 productos por unidades vendidas (Recharts).
- Lista de productos con stock bajo ordenada por stock ascendente.
- Refresco automático por polling (`refetchInterval` 30 s, pausado con la pestaña oculta).

No incluye:
- Selector de rango de fechas: la ventana es fija en 30 días.
- Editar `low_stock_threshold` desde la UI de productos (002 no se toca; solo aplica el
  default al insertar).
- Distribución de pedidos por estado (pie/donut): descartada.
- WebSockets/SSE, exportaciones, comparativa contra periodo anterior.
- Cambios en `proxy.ts`, en la semilla de roles/permisos o en el módulo de productos.
- Lo que cubren 012 (pedidos), 013 (inventario) y 014 (finanzas): son specs aparte.

## Criterios de aceptación
- [x] AC1 — Dado un admin con `dashboard.view`, cuando abre `/admin`, entonces ve las 4 tarjetas de KPI con datos de los últimos 30 días.
- [x] AC2 — Dado pedidos en estado `pending`, `failed` o `canceled`, entonces no suman en ningún KPI ni en ningún gráfico: solo cuentan los `paid`.
- [x] AC3 — Dado un día del rango sin ventas, cuando se pinta la línea, entonces ese día aparece en el eje X con valor 0 (30 puntos siempre, sin huecos).
- [x] AC4 — Dado 0 pedidos pagados en el rango, entonces el ticket promedio es 0 y no se divide por cero.
- [x] AC5 — Dado un producto activo y no borrado con `stock <= low_stock_threshold`, entonces aparece en la lista de stock bajo y suma en el KPI; un producto inactivo o con `deleted_at` no aparece.
- [x] AC6 — Dado el dashboard abierto, cuando pasan 30 s con la pestaña visible, entonces los datos se refrescan; con la pestaña oculta no se lanza la petición.
- [x] AC7 — Dado un usuario sin `dashboard.view`, cuando llama a `GET /api/admin/metrics`, entonces responde 403 (401 si no hay sesión), sin filtrar datos.
- [x] AC8 — Dado el estado de carga, entonces hay skeletons en tarjetas y gráficos; dado un fallo de red, entonces hay mensaje de error y botón "Reintentar".
- [x] AC9 — Dado que no hay ventas ni stock bajo, entonces cada bloque muestra su estado vacío en vez de un gráfico en blanco.
- [x] AC10 — Dados importes en centavos, cuando se muestran en tarjetas, ejes y tooltips, entonces se formatean con `formatPrice()`; nunca se guarda ni se opera con decimales.

## Datos
Único cambio de esquema (**requiere migración**):

| Tabla | Columna | Tipo | Constraint |
|---|---|---|---|
| `products` | `low_stock_threshold` | `integer` | `not null default 5`, check `products_low_stock_threshold_non_negative` (`>= 0`) |

Lectura (sin cambios): `orders` (`status`, `total_cents`, `created_at`), `order_items`
(`order_id`, `product_id`, `product_name`, `quantity`), `products` (`id`, `name`, `sku`,
`stock`, `is_active`, `deleted_at`). Tipos vía `InferSelectModel`, sin redeclarar.

Agrupación diaria **en SQL por día UTC** (`date_trunc('day', created_at)`): a diferencia
de 009 (historial por usuario, TZ local), esto es un agregado global de negocio y la
ventana es fija, así que UTC es la referencia correcta y evita traer filas crudas.

## API
| Método | Ruta | Auth | Query / Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/metrics` | `requirePermission("dashboard.view")` | — | 200 `DashboardMetrics` · 401 · 403 · 500 |

**Sin Zod de entrada a propósito**: el endpoint no acepta query params ni body (rango fijo
de 30 días), así que no hay input que validar. No es un incumplimiento de CLAUDE.md §4.4.

`DashboardMetrics` = `{ rangeStart, rangeEnd (ISO), summary { salesCents, orders,
averageTicketCents, lowStockCount }, daily: { date: "YYYY-MM-DD", salesCents, orders }[],
topProducts: { productId, name, units, salesCents }[], lowStock: { id, name, sku, stock,
threshold }[] }`. Importes siempre en centavos enteros.

## Reutilizar
- `src/lib/permissions.ts` — `requirePermission("dashboard.view")`; el permiso ya está sembrado (003) para `super_admin`, `admin` y `manager`. No comparar nombres de rol.
- `src/app/api/admin/audit-logs/route.ts` — patrón exacto de Route Handler admin (guard → try/catch → `NextResponse.json`).
- `src/server/repositories/order.repository.ts` — estilo de query Drizzle del proyecto (`db.select({...}).from().innerJoin()`), referencia para el repositorio nuevo.
- `src/components/shared/admin-sidebar.tsx` — ya enlaza `/admin`; no se toca.
- `src/app/(admin)/admin/layout.tsx` — la página nueva hereda shell y guard; no se toca.
- `src/modules/products/constants.ts` — `formatPrice(cents)`; no crear otro formateador de moneda.
- `src/modules/users/{constants,services,hooks}` — patrón de query keys, service axios y hook TanStack Query a replicar.
- `src/lib/axios.ts` (`api`) · `src/lib/api-error.ts` (`getApiErrorMessage`).
- `src/testing/mocks/db.mock.ts` — `mockDbQuery()` para los tests del repositorio.
- shadcn ya instalados y suficientes para KPIs y lista: `card`, `table`, `skeleton`, `badge`, `button`, `empty`, `separator`.
- **Falta instalar**: `npx shadcn@latest add chart` (wrapper `ChartContainer`/`ChartTooltip` sobre Recharts; `recharts@3` ya está en `package.json`).
- `lucide-react` — `TrendingUp`, `ShoppingCart`, `Receipt`, `PackageX`.

## Tareas
- [x] T1 — Columna `lowStockThreshold` (integer, notNull, default 5) + check de no negatividad · `src/server/db/schema/product.ts`
- [x] T2 — Generar y aplicar la migración (`npm run db:generate && npm run db:migrate`) · `drizzle/`
- [x] T3 — Tipos del payload `DashboardMetrics` y sus partes · `src/modules/dashboard/types/dashboard.types.ts`
- [x] T4 — Funciones puras `fillMissingDays(rows, start, days)` y `averageTicketCents(salesCents, orders)` · `src/modules/dashboard/lib/metrics-series.ts`
- [x] T5 — Tests `node --test` de T4 (días sin ventas a 0, orden ascendente, 0 pedidos → 0) · `src/modules/dashboard/lib/metrics-series.test.ts`
- [x] T6 — Query `getSalesSummary(since)`: `sum(total_cents)` y `count(*)` de `orders` `paid` · `src/server/repositories/metrics.repository.ts`
- [x] T7 — Query `getDailySales(since)`: agrupada por `date_trunc('day', created_at)` UTC, orden ascendente · mismo archivo
- [x] T8 — Query `getTopProducts(since, limit)`: join `order_items` × `orders` `paid`, `sum(quantity)` desc · mismo archivo
- [x] T9 — Query `findLowStockProducts(limit)`: `stock <= low_stock_threshold`, activos, `deleted_at is null`, orden `stock asc` · mismo archivo
- [x] T10 — Tests del repositorio con `mockDbQuery()` · `src/server/repositories/metrics.repository.test.ts`
- [x] T11 — Servicio `getDashboardMetrics()`: calcula la ventana de 30 días, lanza las 4 queries con `Promise.all` y arma el payload (usa T4) · `src/server/services/dashboard.service.ts`
- [x] T12 — Route Handler: guard de permiso → service → 200/500 · `src/app/api/admin/metrics/route.ts`
- [x] T13 — Service axios `getDashboardMetrics()` · `src/modules/dashboard/services/dashboard.service.ts`
- [x] T14 — Query keys `dashboardKeys` + constantes (`POLL_INTERVAL_MS = 30_000`, `RANGE_DAYS = 30`) · `src/modules/dashboard/constants.ts`
- [x] T15 — Hook `useDashboardMetrics()` (`refetchInterval`, `refetchIntervalInBackground: false`) · `src/modules/dashboard/hooks/use-dashboard-metrics.ts`
- [x] T16 — Tarjetas de KPI presentacionales · `src/modules/dashboard/components/kpi-cards.tsx`
- [x] T17 — Línea de ventas/pedidos por día (Recharts, eje Y de importes con `formatPrice`) · `src/modules/dashboard/components/sales-line-chart.tsx`
- [x] T18 — Barras horizontales de top productos · `src/modules/dashboard/components/top-products-chart.tsx`
- [x] T19 — Lista de stock bajo con `Table` y estado vacío · `src/modules/dashboard/components/low-stock-list.tsx`
- [x] T20 — Contenedor `"use client"` que consume el hook y cubre carga / error+reintentar / vacío · `src/modules/dashboard/components/dashboard-view.tsx`
- [x] T21 — Página Server Component que monta `DashboardView` · `src/app/(admin)/admin/page.tsx`

Verificación final: `npm run typecheck && npm run lint && npm run test` (el `build` lo corre el reviewer)

## Notas
- **Skill obligatoria en T17/T18**: usar `dataviz` antes de escribir los gráficos (paleta, ejes, leyendas, legibilidad en claro/oscuro), según CLAUDE.md §8.
- **Dos series, dos escalas.** Ventas (centavos) y pedidos (unidades) no comparten eje: eje Y doble o dos gráficos; decidirlo con `dataviz`, no mezclar magnitudes en un eje único.
  **Resuelto en T17: dos gráficos apilados (small multiples), no eje Y doble.** `dataviz`
  prohíbe el eje doble sin excepción ("Never a dual-axis chart"): la alineación entre las
  dos escalas es arbitraria e inventa una correlación que no está en el dato. Los dos
  facets comparten el eje X y un ancho de eje Y fijo (92 px) para que las áreas de dibujo
  queden alineadas y un mismo día caiga en la misma X.
- **Color de las series (T17/T18).** Cada gráfico lleva una sola serie, así que no hay
  identidad que separar por tono y no aplica paleta categórica. Se usa `var(--primary)`,
  que ya invierte por tema. Los tokens `--chart-1..5` del proyecto son grises sin croma y
  el validador de `dataviz` los deja por debajo de 3:1 contra la superficie en algún modo
  (`--chart-1` 1.48:1 en claro; `--chart-3` 2.29:1 y `--chart-4` 1.73:1 en oscuro);
  `--primary` pasa en ambos. No se añaden tokens globales nuevos.
- **Filas existentes.** El default `5` se aplica a todos los productos ya creados al correr la migración; no hay backfill manual ni dato a migrar.
- **Efecto colateral controlado.** `product.repository.ts` selecciona el objeto `product` completo, así que `lowStockThreshold` empezará a viajar en las respuestas de productos. Es inocuo (no es dato sensible) y no obliga a tocar 002.
- **Polling y caché.** `makeQueryClient()` tiene `staleTime: 60 s`, mayor que el intervalo de 30 s: el hook debe fijar su propio `staleTime` por debajo del intervalo o el refetch periódico no traerá datos nuevos.
- **Coste de la query.** Las 4 agregaciones corren en paralelo sobre una ventana de 30 días; si el top de productos o la serie diaria se vuelven lentos, el índice a añadir es sobre `orders(status, created_at)` — no se incluye ahora para no inventar índices sin medición.
