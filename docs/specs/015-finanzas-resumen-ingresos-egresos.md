---
id: 015
title: Finanzas — resumen, ingresos y egresos (solo lectura)
status: done
module: finance
scope: admin
---

# 015 — Finanzas — resumen, ingresos y egresos (solo lectura)

## Contexto
014 (done) dejó el ledger automático (`finance_income`/`finance_expense`) y los permisos
`finance.view`/`finance.manage`, pero sin ninguna página ni entrada de menú — hoy el módulo
es invisible en el panel. Este spec lo hace navegable: resumen + dos listados. Dos recortes
de alcance respecto a la idea original, por presupuesto de spec (120 líneas):
- **Sin selector de rango de fechas.** 011 tampoco lo tiene (ventana fija de 30 días); no
  existe ningún componente de calendario/rango instalado en el proyecto. Este spec sigue el
  mismo precedente en vez de construir un date-picker nuevo.
- **Sin CRUD manual de ingresos/egresos.** Las listas son de solo lectura sobre las filas
  automáticas que ya genera 014. El formulario de alta/edición/borrado manual es 016.

## Objetivo
Un admin con `finance.view` ve, sin recargar, el estado financiero de los últimos 30 días
(ingresos, egresos, IGV informativo, ganancia neta) y puede listar el detalle de ingresos y
egresos reales.

## Alcance
Incluye:
- Entrada "Finanzas" en `admin-sidebar.tsx` → `/admin/finance`.
- `/admin/finance` (Resumen): KPIs de 30 días, gráfico diario ingresos/egresos, aviso de
  cobertura de costeo.
- `/admin/finance/income` y `/admin/finance/expenses`: listado de solo lectura (tabla,
  filtro, paginación) de las filas ya existentes.
- 3 endpoints `GET` nuevos bajo `/api/admin/finance`.

No incluye:
- CRUD manual de ingresos/egresos (016). Costeo por lote, Precio Unitario (spec futuro),
  selector de rango de fechas, exportaciones.

## Criterios de aceptación
- [x] AC1 — Dado un admin con `finance.view`, ve "Finanzas" en el sidebar; sin el permiso, no aparece.
- [x] AC2 — `/admin/finance` muestra, de los últimos 30 días: ingresos totales, egresos
  totales (desglosado COGS/envío), IGV informativo, ganancia neta = ingresos − egresos (el
  IGV **no** se resta, por decisión ya tomada).
- [x] AC3 — Dado pedidos del rango con líneas sin `cost_cents`, el resumen muestra un aviso
  con el % de ventas cubiertas por costeo (agregado de `metadata` de las filas `order_cogs`).
- [x] AC4 — Dado 0 pedidos pagados en el rango, los KPIs son 0 sin dividir por cero.
- [x] AC5 — Gráfico de línea con ingresos y egresos por día, 30 puntos sin huecos (día sin
  movimiento = 0); mismas unidades (centavos), un solo eje.
- [x] AC6 — `/admin/finance/income` y `/admin/finance/expenses` listan las filas reales con
  filtro por `origin` y rango `from`/`to`, paginadas.
- [x] AC7 — Sin `finance.view`: 403 en los 3 `GET`, y `proxy.ts` corta las páginas antes del
  Server Component.
- [x] AC8 — Skeletons en carga, mensaje + reintentar en error de red, estado vacío si no hay
  movimientos, en las 3 páginas.
- [x] AC9 — Todo importe se formatea con `formatPrice()`; nunca se opera con decimales.

## Datos
Sin cambios de esquema. Solo lectura de `finance_income`/`finance_expense` (014).

## API
| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/summary` | `finance.view` | — | 200 `FinanceSummary` |
| GET | `/api/admin/finance/income` | `finance.view` | `from?,to?,limit?` | 200 `FinanceIncomeListItem[]` |
| GET | `/api/admin/finance/expenses` | `finance.view` | `from?,to?,limit?` | 200 `FinanceExpenseListItem[]` |

Zod (`financeListFiltersSchema`): mismo patrón que `auditLogFiltersSchema` — `from`/`to`
como `z.coerce.date().optional()`, `limit` `z.coerce.number().int().min(1).max(200).default(100)`.

`FinanceSummary` = `{ rangeStart, rangeEnd, incomeCents, expenseCents: {cogs, shipping,
total}, igvCents, netProfitCents, costCoverage: {coveredSalesCents, excludedSalesCents,
coveragePct}, daily: {date, incomeCents, expenseCents}[] }`.

## Reutilizar
- `src/modules/audit-logs/**` — plantilla completa a replicar (schema de filtros con
  `from`/`to`, service axios, hook, `createColumnHelper<DataTableFeatures, T>()`, página):
  mismo patrón para Ingresos y Egresos, cambiando solo las columnas.
- `src/components/shared/data-table.tsx` (`DataTable`) — tabla con búsqueda, filtro por
  columna, orden y paginación ya resuelta; no se reescribe.
- `src/server/repositories/finance.repository.ts` — ya tiene `getSettings`; se amplía, no se
  duplica.
- `src/modules/dashboard/lib/metrics-series.ts` (`fillMissingDays`) — serie diaria sin
  huecos, ya probada; se reusa para ingresos y para egresos.
- `src/modules/products/constants.ts` (`formatPrice`) — único formateador de moneda.
- `src/lib/axios.ts` (`api`) · `src/lib/api-error.ts` (`getApiErrorMessage`).
- `src/testing/mocks/db.mock.ts` (`mockDbQuery`).
- `src/components/shared/admin-sidebar.tsx` — agregar `NavItem`, mismo patrón que las 8
  entradas existentes (icon `Wallet` de `lucide-react`).
- shadcn ya instalados y suficientes: `card`, `table`, `select`, `input`, `button`,
  `skeleton`, `badge`, `empty`. `chart` ya se instaló en 011.

## Tareas
- [x] T1 — `estimateIgvCents(grossAmountCents)` (constante `IGV_RATE = 0.18`, desglosa el
  IGV ya incluido en el precio) + test · `src/modules/finance/lib/igv.ts`
- [x] T2 — `financeRepository`: `getSummaryTotals(rangeStart, rangeEnd)` (suma ingresos, suma
  egresos por `origin`, agregado de `metadata` de `order_cogs`), `getDailyLedger(rangeStart,
  rangeEnd)`, `getIncomeList(filters)`, `getExpenseList(filters)` ·
  `src/server/repositories/finance.repository.ts`
- [x] T3 — Tests del repositorio con `mockDbQuery()` ·
  `src/server/repositories/finance.repository.test.ts`
- [x] T4 — `financeListFiltersSchema` · `src/modules/finance/schemas/finance.schema.ts`
- [x] T5 — Tipos `FinanceSummary`, `FinanceIncomeListItem`, `FinanceExpenseListItem` ·
  `src/modules/finance/types/finance.types.ts`
- [x] T6 — Servicio `getFinanceSummary()`: ventana de `RANGE_DAYS = 30`, arma el payload con
  T1 + `fillMissingDays` · `src/server/services/finance-summary.service.ts`
- [x] T7 — `GET /api/admin/finance/summary` (guard → service → 200/500) ·
  `src/app/api/admin/finance/summary/route.ts`
- [x] T8 — `GET /api/admin/finance/income` (guard → Zod query → repo → 200/400/500) ·
  `src/app/api/admin/finance/income/route.ts`
- [x] T9 — `GET /api/admin/finance/expenses` (mismo patrón que T8) ·
  `src/app/api/admin/finance/expenses/route.ts`
- [x] T10 — Service axios (`getFinanceSummary`, `getFinanceIncome`, `getFinanceExpenses`) ·
  `src/modules/finance/services/finance.service.ts`
- [x] T11 — Query keys `financeKeys` + `RANGE_DAYS` · `src/modules/finance/constants.ts`
- [x] T12 — Hooks `useFinanceSummary()`, `useFinanceIncome(filters)`,
  `useFinanceExpenses(filters)` · `src/modules/finance/hooks/`
- [x] T13 — Tarjetas de KPI (ingresos, egresos desglosado, IGV informativo, ganancia neta +
  aviso de cobertura) · `src/modules/finance/components/summary-cards.tsx`
- [x] T14 — Gráfico de línea ingresos/egresos por día (Recharts, un eje, dos series) ·
  `src/modules/finance/components/daily-chart.tsx`
- [x] T15 — `buildIncomeColumns()` (origen, monto, fecha, link al pedido si aplica) ·
  `src/modules/finance/components/income-columns.tsx`
- [x] T16 — `buildExpenseColumns()` (origen, categoría, monto, fecha, link al pedido) ·
  `src/modules/finance/components/expense-columns.tsx`
- [x] T17 — Página `/admin/finance` (Resumen): carga/error+reintentar/vacío ·
  `src/app/(admin)/admin/finance/page.tsx`
- [x] T18 — Página `/admin/finance/income` (usa `DataTable` + T15) ·
  `src/app/(admin)/admin/finance/income/page.tsx`
- [x] T19 — Página `/admin/finance/expenses` (usa `DataTable` + T16) ·
  `src/app/(admin)/admin/finance/expenses/page.tsx`
- [x] T20 — Entrada "Finanzas" (`Wallet`, `finance.view`) ·
  `src/components/shared/admin-sidebar.tsx`

Verificación final: `npm run typecheck && npm run lint && npm run test` (el `build` lo corre
el reviewer)

## Notas
- **Skill obligatoria en T14**: `dataviz` antes de elegir colores/ejes del gráfico
  (CLAUDE.md §8). A diferencia de 011, aquí ambas series comparten unidad (centavos), así que
  un solo eje con dos colores categóricos es válido — no aplica la restricción de eje doble.
- **Cobertura de costeo (AC3).** Se calcula sobre `metadata.excludedSalesCents` /
  `itemsWithCost`+`itemsWithoutCost` que 014 ya guarda en cada fila `order_cogs`; no hace
  falta releer `order_items` ni `products`.
- **Filtro por `origin` en las listas.** Hoy todas las filas son `order`/`order_cogs`/
  `order_shipping` (sin manuales); el filtro ya soporta el valor `manual` para que 016 no
  toque este spec al agregarlo.
