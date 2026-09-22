---
id: 016
title: Finanzas — CRUD manual de ingresos y egresos
status: done
module: finance
scope: admin
---

# 016 — Finanzas — CRUD manual de ingresos y egresos

## Contexto
015 (done) dejó Ingresos y Egresos como listados de solo lectura: hoy la única forma de que
Finanzas muestre cifras es un pedido pagado real, y los egresos siempre dan 0 porque nada
tiene `cost_cents` ni hay tarifa de envío configurada. Este spec cierra ese hueco: alta,
edición y borrado de filas `manual` (el schema de 014 ya las soporta por completo — sin
cambios de esquema). El costo por producto y la tarifa de envío quedan fuera: es un spec
aparte (017), sin relación con el CRUD.

## Objetivo
Un admin con `finance.manage` da de alta, edita y borra ingresos y egresos manuales desde
`/admin/finance/income` y `/admin/finance/expenses`, y los ve reflejados de inmediato en esos
listados y en el Resumen.

## Alcance
Incluye:
- Botón "Nuevo ingreso"/"Nuevo egreso" + diálogo de alta/edición en ambas páginas.
- Columna de acciones (editar/borrar) en las tablas, visible solo en filas `origin: manual` y
  solo para quien tiene `finance.manage` (quien solo tiene `finance.view` no las ve).
- Confirmación de borrado.
- 6 endpoints nuevos: crear/editar/borrar ingreso, crear/editar/borrar egreso.

No incluye:
- Editar o borrar filas `order`/`order_cogs`/`order_shipping` (protegido en Datos, 014).
- Costo por producto, tarifa de envío, Precio Unitario — spec 017.

## Criterios de aceptación
- [ ] AC1 — Un admin con `finance.manage` crea un ingreso manual (categoría, monto, fecha,
  descripción opcional); aparece en `/admin/finance/income` y suma en el Resumen.
- [ ] AC2 — Igual para egresos manuales, con categoría de la lista fija (`alquiler`,
  `servicios`, `marketing`, `personal`, `otro`).
- [ ] AC3 — Editar una entrada manual actualiza sus campos y se refleja en la lista y el
  Resumen sin recargar.
- [ ] AC4 — Borrar una entrada manual la quita de la lista y del Resumen.
- [ ] AC5 — Las filas de origen `order`/`order_cogs`/`order_shipping` no muestran acciones en
  la tabla; un `PATCH`/`DELETE` directo contra su `id` responde 404 (la query solo alcanza
  filas `origin = 'manual'`, nunca las automáticas).
- [ ] AC6 — Monto negativo/no entero o categoría fuera del enum: Zod rechaza con 400 antes de
  tocar la base.
- [ ] AC7 — Toda creación/edición/borrado escribe en `audit_logs` en la misma transacción, sin
  PII.
- [ ] AC8 — Sin `finance.manage`: 403 en los 6 endpoints; con solo `finance.view`, la UI no
  ofrece "Nuevo ingreso/egreso" ni acciones de fila (no solo las oculta el backend).

## Datos
Sin cambios de esquema. `finance_income`/`finance_expense` (014) ya validan en Postgres que
una fila `manual` tenga `order_id is null` y `category is not null` (checks existentes).

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/admin/finance/income` | `finance.manage` | `{amountCents,category,occurredAt,description?}` | 201 · 400 · 403 |
| PATCH | `/api/admin/finance/income/:id` | `finance.manage` | subconjunto del anterior | 200 · 400 · 403 · 404 |
| DELETE | `/api/admin/finance/income/:id` | `finance.manage` | — | 204 · 403 · 404 |
| POST | `/api/admin/finance/expenses` | `finance.manage` | `{amountCents,category,occurredAt,description?}` | 201 · 400 · 403 |
| PATCH | `/api/admin/finance/expenses/:id` | `finance.manage` | subconjunto del anterior | 200 · 400 · 403 · 404 |
| DELETE | `/api/admin/finance/expenses/:id` | `finance.manage` | — | 204 · 403 · 404 |

Zod (ambas entidades, mismo shape): `amountCents` reusa la constante ya definida en
`finance.schema.ts`; `category` = `z.enum([...])` del enum correspondiente; `occurredAt` =
`z.coerce.date()`; `description` = `z.string().trim().max(200).optional()`. El `update` es el
mismo objeto con todos los campos `.optional()`.

## Reutilizar
- `src/modules/categories/components/{category-form-dialog,delete-category-dialog}.tsx` y
  `src/modules/categories/hooks/use-category-mutations.ts` — plantilla completa del CRUD
  (RHF + `zodResolver`, `Field`/`FieldLabel`/`FieldError`, `Dialog`, `AlertDialog`,
  mutaciones con `toast` + `invalidateQueries`). Mismo patrón, dos entidades.
- `src/modules/products/components/product-columns.tsx` — columna de acciones con
  `DropdownMenu`/`Pencil`/`Trash2` a replicar, condicionada a `origin === "manual"`.
- `src/app/api/admin/finance/settings/route.ts` (014) — patrón exacto de `PATCH` con
  `runBatch([mutación, buildAuditLogInsert(...)])`; se replica para los 6 endpoints nuevos.
- `src/app/(admin)/admin/users/page.tsx` — patrón `can("finance.manage", user)` calculado en
  el Server Component y pasado como prop a la tabla cliente (AC8).
- `src/server/repositories/finance.repository.ts` — ya tiene `buildUpdateSettings` como
  ejemplo de statement de `UPDATE` sin ejecutar; se sigue el mismo estilo para los manuales.
- `src/lib/audit.ts` (`AUDIT_ACTIONS`, `buildAuditLogInsert`, `getRequestAuditContext`).
- `src/modules/finance/{constants,hooks,components}` (015) — `financeKeys`, `useFinanceIncome`,
  `useFinanceExpenses`, `income-columns.tsx`, `expense-columns.tsx`, `income-table.tsx`,
  `expenses-table.tsx`: se amplían, no se recrean.

## Tareas
- [x] T1 — `financeRepository`: `buildManualIncomeInsert(input)`,
  `buildManualIncomeUpdate(id, input)`, `buildManualIncomeDelete(id)`,
  `buildManualExpenseInsert(input)`, `buildManualExpenseUpdate(id, input)`,
  `buildManualExpenseDelete(id)` — `update`/`delete` filtran `origin = 'manual'` en el `where`
  · `src/server/repositories/finance.repository.ts`
- [x] T2 — Tests del repositorio (incluye: actualizar/borrar una fila `order*` no afecta
  filas) · `src/server/repositories/finance.repository.test.ts`
- [x] T3 — `createManualIncomeSchema`, `updateManualIncomeSchema`,
  `createManualExpenseSchema`, `updateManualExpenseSchema` ·
  `src/modules/finance/schemas/finance.schema.ts`
- [x] T4 — Tests de los schemas · `src/modules/finance/schemas/finance.schema.test.ts`
- [x] T5 — `AUDIT_ACTIONS`: `FINANCE_INCOME_CREATED/UPDATED/DELETED`,
  `FINANCE_EXPENSE_CREATED/UPDATED/DELETED` · `src/lib/audit.ts`
- [x] T6 — `POST /api/admin/finance/income` (guard → Zod → batch+audit → 201) ·
  `src/app/api/admin/finance/income/route.ts`
- [x] T7 — `PATCH`/`DELETE /api/admin/finance/income/[id]` (guard → Zod → batch+audit →
  200/204/404) · `src/app/api/admin/finance/income/[id]/route.ts`
- [x] T8 — `POST /api/admin/finance/expenses` (mismo patrón que T6) ·
  `src/app/api/admin/finance/expenses/route.ts`
- [x] T9 — `PATCH`/`DELETE /api/admin/finance/expenses/[id]` (mismo patrón que T7) ·
  `src/app/api/admin/finance/expenses/[id]/route.ts`
- [x] T10 — Service axios: `createFinanceIncome`, `updateFinanceIncome`,
  `deleteFinanceIncome`, `createFinanceExpense`, `updateFinanceExpense`,
  `deleteFinanceExpense` · `src/modules/finance/services/finance.service.ts`
- [x] T11 — Hooks de mutación (invalidan `financeKeys.all` en `onSuccess`, `toast` en éxito y
  error) · `src/modules/finance/hooks/use-finance-income-mutations.ts` y
  `use-finance-expense-mutations.ts`
- [x] T12 — `IncomeFormDialog` (alta/edición) ·
  `src/modules/finance/components/income-form-dialog.tsx`
- [x] T13 — `ExpenseFormDialog` (alta/edición, con `Select` de categoría) ·
  `src/modules/finance/components/expense-form-dialog.tsx`
- [x] T14 — `DeleteFinanceEntryDialog` compartido (`AlertDialog`, recibe tipo
  `"income" | "expense"`) · `src/modules/finance/components/delete-entry-dialog.tsx`
- [x] T15 — Columna "Acciones" en `income-columns.tsx` (solo `origin === "manual"` y
  `canManage`) · mismo archivo
- [x] T16 — Columna "Acciones" en `expense-columns.tsx` (mismo criterio) · mismo archivo
- [x] T17 — `income-table.tsx`: botón "Nuevo ingreso", estado de diálogo abierto/fila en
  edición, prop `canManage` · mismo archivo
- [x] T18 — `expenses-table.tsx`: mismo para egresos · mismo archivo
- [x] T19 — Páginas `income/page.tsx` y `expenses/page.tsx`: calculan
  `can("finance.manage", user)` y lo pasan a la tabla · mismos archivos

Verificación final: `npm run typecheck && npm run lint && npm run test` (el `build` lo corre
el reviewer)

## Notas
- **Protección por `origin`, no solo por UI.** AC5 se verifica en el `WHERE` del `UPDATE`/
  `DELETE` (T1), no confiando en que el cliente nunca mande el `id` de una fila automática —
  la UI ya no ofrece el botón, pero el backend es la defensa real.
- **`occurredAt` fuera del rango de 30 días.** Si se registra una fecha pasada, la entrada no
  aparecerá en el Resumen (su ventana es fija) aunque sí en el listado — comportamiento
  esperado, no un bug; no se agrega aviso para esto en este spec.

### Decisiones de implementación
- **`findManualIncomeById`/`findManualExpenseById` (T1).** `db.batch()` no devuelve filas, así
  que el 404 de AC5 y el `before` de la bitácora salen de una lectura previa que ya filtra por
  `origin = 'manual'`. El `WHERE` del `UPDATE`/`DELETE` sigue filtrando igual: son dos capas,
  no una sustituye a la otra.
- **`category` en los dos listados.** `getIncomeList` pasa a seleccionarla (ya lo hacía
  `getExpenseList`): el diálogo de edición precarga sus campos desde la fila ya listada y sin
  ella no podría mostrar la categoría actual (AC3). No se añade columna visible al listado de
  ingresos: queda fuera del alcance.
- **`id` generado en el handler.** El `POST` crea el uuid antes del batch porque el
  `entityId` de `audit_logs` tiene que viajar en la misma sentencia que el insert (AC7).
- **`occurredAt` con unión previa al `coerce`.** `z.coerce.date()` a secas convierte `null` en
  el epoch: el movimiento se guardaría fechado en 1970 en vez de dar 400 (AC6).
- **Piezas compartidas nuevas.** `amount-input.tsx` (importe en unidades sobre un campo en
  centavos) lo usan los dos diálogos, y `LedgerTable` gana una prop `actions` para el botón de
  alta; evita duplicar el mismo bloque en ingresos y egresos.
