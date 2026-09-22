import { and, asc, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db } from "@/server/db";
import type { PgStatement } from "@/server/db/batch";
import {
  financeExpense,
  financeExpenseOrigin,
} from "@/server/db/schema/finance-expense";
import type {
  FinanceExpense,
  FinanceExpenseMetadata,
  FinanceExpenseOrigin,
} from "@/server/db/schema/finance-expense";
import {
  financeIncome,
  financeIncomeOrigin,
} from "@/server/db/schema/finance-income";
import type {
  FinanceIncome,
  FinanceIncomeOrigin,
} from "@/server/db/schema/finance-income";
import {
  financeSettings,
  FINANCE_SETTINGS_ID,
} from "@/server/db/schema/finance-settings";

// Reexpuesto para que el Route Handler pueda identificar la entidad en la
// bitácora sin importar el schema Drizzle: sigue hablando solo con el
// repositorio (SETUP.md §4 regla 3).
export { FINANCE_SETTINGS_ID };

/** Valores de configuración, sin el `id` ni el `updated_at` del singleton. */
export type FinanceSettingsValues = {
  shippingCostCents: number;
};

/**
 * La migración 0006 crea la fila singleton, así que en la práctica siempre
 * existe. El default cubre una base migrada a mano: dejar el fulfillment sin
 * tarifa de envío es peor que asumir cero.
 */
const DEFAULT_SETTINGS: FinanceSettingsValues = { shippingCostCents: 0 };

export async function getSettings(): Promise<FinanceSettingsValues> {
  const [found] = await db
    .select({ shippingCostCents: financeSettings.shippingCostCents })
    .from(financeSettings)
    .where(eq(financeSettings.id, FINANCE_SETTINGS_ID))
    .limit(1);

  return found ?? DEFAULT_SETTINGS;
}

/**
 * Sin ejecutar: viaja en el mismo `batch` que su `audit_logs` (CLAUDE.md §4.9).
 *
 * Es un upsert y no un `update` para que la configuración quede escrita aunque
 * la fila singleton no exista; con un `update` el PATCH afectaría cero filas y
 * respondería 200 sin haber guardado nada.
 */
export function buildUpdateSettings(shippingCostCents: number): PgStatement {
  return db
    .insert(financeSettings)
    .values({ id: FINANCE_SETTINGS_ID, shippingCostCents })
    .onConflictDoUpdate({
      target: financeSettings.id,
      set: { shippingCostCents },
    });
}

/** Lo mínimo del pedido que el ledger necesita: no arrastra líneas ni cliente. */
export type LedgerOrder = {
  id: string;
  totalCents: number;
};

/**
 * Línea del pedido emparejada con el costo vigente de su producto. `costCents`
 * en `null` es "producto sin costear", distinto de un costo de cero.
 */
export type LedgerLine = {
  quantity: number;
  unitPriceCents: number;
  costCents: number | null;
};

export type CogsSummary = FinanceExpenseMetadata & {
  amountCents: number;
};

/**
 * COGS agregado del pedido (014 §Notas): una sola fila con la suma, no una por
 * línea. Las líneas sin costo no aportan al monto —sumar cero inflaría el
 * margen en silencio— y quedan contadas en la metadata para que la vista de
 * margen pueda advertir que el dato está incompleto.
 */
export function summarizeCogs(lines: readonly LedgerLine[]): CogsSummary {
  return lines.reduce<CogsSummary>(
    (summary, line) =>
      line.costCents === null
        ? {
            ...summary,
            itemsWithoutCost: summary.itemsWithoutCost + 1,
            excludedSalesCents:
              summary.excludedSalesCents + line.unitPriceCents * line.quantity,
          }
        : {
            ...summary,
            amountCents: summary.amountCents + line.costCents * line.quantity,
            itemsWithCost: summary.itemsWithCost + 1,
          },
    {
      amountCents: 0,
      itemsWithCost: 0,
      itemsWithoutCost: 0,
      excludedSalesCents: 0,
    },
  );
}

/**
 * Los tres `build*` de ledger llevan `onConflictDoNothing()` sin destino: el
 * arbitraje lo hacen los índices únicos parciales de cada tabla. Es la defensa
 * contra dos entregas simultáneas del mismo evento de Stripe, que el
 * pre-chequeo de estado del fulfillment no cubre (AC4).
 */
export function buildIncomeInsert(order: LedgerOrder): PgStatement {
  return db
    .insert(financeIncome)
    .values({
      origin: "order",
      amountCents: order.totalCents,
      orderId: order.id,
    })
    .onConflictDoNothing();
}

export function buildCogsInsert(
  order: LedgerOrder,
  lines: readonly LedgerLine[],
): PgStatement {
  const { amountCents, ...metadata } = summarizeCogs(lines);

  return db
    .insert(financeExpense)
    .values({
      origin: "order_cogs",
      amountCents,
      orderId: order.id,
      metadata,
    })
    .onConflictDoNothing();
}

export function buildShippingInsert(
  order: LedgerOrder,
  shippingCostCents: number,
): PgStatement {
  return db
    .insert(financeExpense)
    .values({
      origin: "order_shipping",
      amountCents: shippingCostCents,
      orderId: order.id,
    })
    .onConflictDoNothing();
}

/* -------------------------------------------------------------------------
 * Lecturas del panel de Finanzas (015). Solo consultan: la ventana de fechas,
 * el IGV y el relleno de la serie diaria los decide el servicio.
 * ---------------------------------------------------------------------- */

/**
 * `sum()` llega como `string` (Postgres devuelve `numeric`/`bigint` y el driver
 * no lo convierte) o como `null` cuando la agregación no vio ninguna fila. Todo
 * este dominio son centavos enteros: se normaliza aquí para que nadie aguas
 * abajo reciba `null` ni `NaN` (015 AC4).
 */
function toInteger(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/** Rango sobre `occurred_at`: es la fecha del movimiento, no la de registro. */
function occurredBetween(column: PgColumn, from?: Date, to?: Date) {
  return and(
    from ? gte(column, from) : undefined,
    to ? lte(column, to) : undefined,
  );
}

function toAmountsByOrigin<TOrigin extends string>(
  origins: readonly TOrigin[],
  rows: ReadonlyArray<{ origin: TOrigin; amountCents: string | null }>,
): Record<TOrigin, number> {
  const totals = Object.fromEntries(
    origins.map((origin) => [origin, 0]),
  ) as Record<TOrigin, number>;

  for (const row of rows) {
    totals[row.origin] = toInteger(row.amountCents);
  }

  return totals;
}

export type FinanceRangeTotals = {
  incomeByOrigin: Record<FinanceIncomeOrigin, number>;
  expenseByOrigin: Record<FinanceExpenseOrigin, number>;
  /**
   * Venta del rango sin respaldo de costo, agregada desde la `metadata` que
   * cada fila `order_cogs` ya guarda (015 AC3). No se releen `order_items` ni
   * `products`: el costo vigente hoy no es el que tenía el pedido al pagarse.
   */
  excludedSalesCents: number;
};

/** Suma del JSON de trazabilidad del COGS; `->>` devuelve texto, de ahí el cast. */
const EXCLUDED_SALES_CENTS = sql<string>`sum((${financeExpense.metadata} ->> 'excludedSalesCents')::bigint)`;

/**
 * Totales del rango: ingresos y egresos por origen más la cobertura de costeo.
 * Tres agregaciones independientes, de ahí el `Promise.all`.
 */
export async function getSummaryTotals(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<FinanceRangeTotals> {
  const [incomeRows, expenseRows, [coverageRow]] = await Promise.all([
    db
      .select({
        origin: financeIncome.origin,
        amountCents: sum(financeIncome.amountCents),
      })
      .from(financeIncome)
      .where(occurredBetween(financeIncome.occurredAt, rangeStart, rangeEnd))
      .groupBy(financeIncome.origin),
    db
      .select({
        origin: financeExpense.origin,
        amountCents: sum(financeExpense.amountCents),
      })
      .from(financeExpense)
      .where(occurredBetween(financeExpense.occurredAt, rangeStart, rangeEnd))
      .groupBy(financeExpense.origin),
    db
      .select({ excludedSalesCents: EXCLUDED_SALES_CENTS })
      .from(financeExpense)
      .where(
        and(
          eq(financeExpense.origin, "order_cogs"),
          occurredBetween(financeExpense.occurredAt, rangeStart, rangeEnd),
        ),
      ),
  ]);

  return {
    incomeByOrigin: toAmountsByOrigin(
      financeIncomeOrigin.enumValues,
      incomeRows,
    ),
    expenseByOrigin: toAmountsByOrigin(
      financeExpenseOrigin.enumValues,
      expenseRows,
    ),
    excludedSalesCents: toInteger(coverageRow?.excludedSalesCents),
  };
}

/** Un día con movimiento; los días sin ninguno no vienen en el resultado. */
export type DailyAmount = {
  /** Día UTC en formato `YYYY-MM-DD`. */
  date: string;
  amountCents: number;
};

export type DailyLedger = {
  income: DailyAmount[];
  expense: DailyAmount[];
};

/**
 * `occurred_at` es `timestamptz`: un `date_trunc` a secas cortaría por la zona
 * horaria de la sesión, así que el `at time zone 'utc'` fija la referencia. El
 * formato se hace en SQL para no depender de cómo serialice el driver.
 */
function utcDay(column: PgColumn) {
  return sql<string>`to_char(date_trunc('day', ${column} at time zone 'utc'), 'YYYY-MM-DD')`;
}

async function getDailyAmounts(
  table: typeof financeIncome | typeof financeExpense,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<DailyAmount[]> {
  const day = utcDay(table.occurredAt);

  const rows = await db
    .select({ date: day, amountCents: sum(table.amountCents) })
    .from(table)
    .where(occurredBetween(table.occurredAt, rangeStart, rangeEnd))
    .groupBy(day)
    .orderBy(asc(day));

  return rows.map((row) => ({
    date: row.date,
    amountCents: toInteger(row.amountCents),
  }));
}

/**
 * Series diarias de ingreso y de egreso, ascendentes y **sin** los días sin
 * movimiento: `GROUP BY` solo devuelve los días con filas y el relleno a 30
 * puntos lo hace `fillMissingDays` en el servicio (015 AC5).
 */
export async function getDailyLedger(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<DailyLedger> {
  const [income, expense] = await Promise.all([
    getDailyAmounts(financeIncome, rangeStart, rangeEnd),
    getDailyAmounts(financeExpense, rangeStart, rangeEnd),
  ]);

  return { income, expense };
}

/**
 * Filtros de los dos listados. El `origin` no viaja al servidor: son pocas
 * filas ya acotadas por rango y la tabla del panel filtra por columna sobre lo
 * ya cargado, igual que la bitácora (015 §Notas).
 */
export type FinanceListFilters = {
  from?: Date;
  to?: Date;
  limit: number;
};

/**
 * Columnas comunes a los dos listados. La categoría entra en los dos desde 016:
 * el diálogo de edición precarga sus campos desde la fila ya listada, así que
 * sin ella el `PATCH` no podría mostrar el valor actual (016 AC3).
 */
type ListColumn =
  | "id"
  | "origin"
  | "amountCents"
  | "description"
  | "occurredAt"
  | "orderId"
  | "category";

export type FinanceIncomeListItem = Pick<FinanceIncome, ListColumn>;

export type FinanceExpenseListItem = Pick<FinanceExpense, ListColumn>;

export async function getIncomeList(
  filters: FinanceListFilters,
): Promise<FinanceIncomeListItem[]> {
  return db
    .select({
      id: financeIncome.id,
      origin: financeIncome.origin,
      amountCents: financeIncome.amountCents,
      description: financeIncome.description,
      occurredAt: financeIncome.occurredAt,
      orderId: financeIncome.orderId,
      category: financeIncome.category,
    })
    .from(financeIncome)
    .where(occurredBetween(financeIncome.occurredAt, filters.from, filters.to))
    .orderBy(desc(financeIncome.occurredAt))
    .limit(filters.limit);
}

export async function getExpenseList(
  filters: FinanceListFilters,
): Promise<FinanceExpenseListItem[]> {
  return db
    .select({
      id: financeExpense.id,
      origin: financeExpense.origin,
      amountCents: financeExpense.amountCents,
      description: financeExpense.description,
      occurredAt: financeExpense.occurredAt,
      orderId: financeExpense.orderId,
      category: financeExpense.category,
    })
    .from(financeExpense)
    .where(occurredBetween(financeExpense.occurredAt, filters.from, filters.to))
    .orderBy(desc(financeExpense.occurredAt))
    .limit(filters.limit);
}

/* -------------------------------------------------------------------------
 * CRUD de las filas manuales (016). Solo alcanzan `origin = 'manual'`: las
 * derivadas del pedido son el reflejo contable de la venta y no se tocan desde
 * el panel (016 AC5). El filtro va en el `WHERE`, no en la UI: es la defensa
 * real contra un `PATCH`/`DELETE` directo contra el id de una fila automática.
 * ---------------------------------------------------------------------- */

export type FinanceIncomeCategory = NonNullable<FinanceIncome["category"]>;
export type FinanceExpenseCategory = NonNullable<FinanceExpense["category"]>;

/**
 * Alta manual. `origin` y `orderId` no viajan en el tipo: los fija el
 * repositorio, así que un llamador no puede colar una fila de pedido por esta
 * puerta. El `id` lo genera el handler porque `db.batch()` no devuelve filas y
 * la bitácora necesita el `entityId` dentro del mismo batch.
 */
type NewManualEntry<TCategory extends string> = {
  id: string;
  amountCents: number;
  category: TCategory;
  occurredAt: Date;
  description: string | null;
  createdBy: string | null;
};

/** Edición parcial: solo los campos que el `PATCH` trae. */
type ManualEntryChanges<TCategory extends string> = Partial<
  Omit<NewManualEntry<TCategory>, "id" | "createdBy">
>;

export type NewManualIncome = NewManualEntry<FinanceIncomeCategory>;
export type ManualIncomeChanges = ManualEntryChanges<FinanceIncomeCategory>;
export type NewManualExpense = NewManualEntry<FinanceExpenseCategory>;
export type ManualExpenseChanges = ManualEntryChanges<FinanceExpenseCategory>;

/** Campos editables de una fila manual, tal como los necesita la bitácora. */
export type ManualIncomeRow = Pick<
  FinanceIncome,
  "id" | "amountCents" | "category" | "occurredAt" | "description"
>;

export type ManualExpenseRow = Pick<
  FinanceExpense,
  "id" | "amountCents" | "category" | "occurredAt" | "description"
>;

export async function findManualIncomeById(
  id: string,
): Promise<ManualIncomeRow | null> {
  const [found] = await db
    .select({
      id: financeIncome.id,
      amountCents: financeIncome.amountCents,
      category: financeIncome.category,
      occurredAt: financeIncome.occurredAt,
      description: financeIncome.description,
    })
    .from(financeIncome)
    .where(and(eq(financeIncome.id, id), eq(financeIncome.origin, "manual")))
    .limit(1);

  return found ?? null;
}

export async function findManualExpenseById(
  id: string,
): Promise<ManualExpenseRow | null> {
  const [found] = await db
    .select({
      id: financeExpense.id,
      amountCents: financeExpense.amountCents,
      category: financeExpense.category,
      occurredAt: financeExpense.occurredAt,
      description: financeExpense.description,
    })
    .from(financeExpense)
    .where(and(eq(financeExpense.id, id), eq(financeExpense.origin, "manual")))
    .limit(1);

  return found ?? null;
}

/** Los seis `build*` viajan sin ejecutar, en el batch de su `audit_logs`. */
export function buildManualIncomeInsert(entry: NewManualIncome): PgStatement {
  return db.insert(financeIncome).values({ ...entry, origin: "manual" });
}

export function buildManualIncomeUpdate(
  id: string,
  changes: ManualIncomeChanges,
): PgStatement {
  return db
    .update(financeIncome)
    .set(changes)
    .where(and(eq(financeIncome.id, id), eq(financeIncome.origin, "manual")));
}

export function buildManualIncomeDelete(id: string): PgStatement {
  return db
    .delete(financeIncome)
    .where(and(eq(financeIncome.id, id), eq(financeIncome.origin, "manual")));
}

export function buildManualExpenseInsert(entry: NewManualExpense): PgStatement {
  return db.insert(financeExpense).values({ ...entry, origin: "manual" });
}

export function buildManualExpenseUpdate(
  id: string,
  changes: ManualExpenseChanges,
): PgStatement {
  return db
    .update(financeExpense)
    .set(changes)
    .where(and(eq(financeExpense.id, id), eq(financeExpense.origin, "manual")));
}

export function buildManualExpenseDelete(id: string): PgStatement {
  return db
    .delete(financeExpense)
    .where(and(eq(financeExpense.id, id), eq(financeExpense.origin, "manual")));
}
