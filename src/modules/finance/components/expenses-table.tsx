"use client";

import { useMemo, useState } from "react";

import { buildExpenseColumns } from "@/modules/finance/components/expense-columns";
import {
  EMPTY_RANGE,
  LedgerTable,
  type LedgerRange,
} from "@/modules/finance/components/ledger-table";
import { EXPENSE_ORIGIN_OPTIONS } from "@/modules/finance/constants";
import { useFinanceExpenses } from "@/modules/finance/hooks/use-finance-expenses";

const ORIGIN_FILTER = {
  columnId: "origin",
  label: "Origen",
  options: EXPENSE_ORIGIN_OPTIONS,
} as const;

/** Frontera de cliente del libro de egresos (015 T19). */
export function ExpensesTable() {
  // El rango acota la consulta en el servidor (el ledger crece con cada pedido
  // pagado); el origen se filtra sobre el resultado ya cargado.
  const [range, setRange] = useState<LedgerRange>(EMPTY_RANGE);

  const query = useFinanceExpenses({
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const columns = useMemo(() => buildExpenseColumns(), []);

  return (
    <LedgerTable
      columns={columns}
      query={query}
      originFilter={ORIGIN_FILTER}
      onApplyRange={setRange}
      errorTitle="No se pudieron cargar los egresos"
      searchPlaceholder="Buscar por concepto..."
      emptyMessage="No hay egresos para estos filtros."
    />
  );
}
