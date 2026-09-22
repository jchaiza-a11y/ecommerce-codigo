"use client";

import { useMemo, useState } from "react";

import { buildIncomeColumns } from "@/modules/finance/components/income-columns";
import {
  EMPTY_RANGE,
  LedgerTable,
  type LedgerRange,
} from "@/modules/finance/components/ledger-table";
import { INCOME_ORIGIN_OPTIONS } from "@/modules/finance/constants";
import { useFinanceIncome } from "@/modules/finance/hooks/use-finance-income";

const ORIGIN_FILTER = {
  columnId: "origin",
  label: "Origen",
  options: INCOME_ORIGIN_OPTIONS,
} as const;

/** Frontera de cliente del libro de ingresos (015 T18). */
export function IncomeTable() {
  // El rango acota la consulta en el servidor (el ledger crece con cada pedido
  // pagado); el origen se filtra sobre el resultado ya cargado.
  const [range, setRange] = useState<LedgerRange>(EMPTY_RANGE);

  const query = useFinanceIncome({
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const columns = useMemo(() => buildIncomeColumns(), []);

  return (
    <LedgerTable
      columns={columns}
      query={query}
      originFilter={ORIGIN_FILTER}
      onApplyRange={setRange}
      errorTitle="No se pudieron cargar los ingresos"
      searchPlaceholder="Buscar por concepto..."
      emptyMessage="No hay ingresos para estos filtros."
    />
  );
}
