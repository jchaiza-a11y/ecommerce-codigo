"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeleteFinanceEntryDialog } from "@/modules/finance/components/delete-entry-dialog";
import { buildIncomeColumns } from "@/modules/finance/components/income-columns";
import { IncomeFormDialog } from "@/modules/finance/components/income-form-dialog";
import {
  EMPTY_RANGE,
  LedgerTable,
  type LedgerRange,
} from "@/modules/finance/components/ledger-table";
import { INCOME_ORIGIN_OPTIONS } from "@/modules/finance/constants";
import { useFinanceIncome } from "@/modules/finance/hooks/use-finance-income";
import type { FinanceIncomeListItem } from "@/modules/finance/types/finance.types";

const ORIGIN_FILTER = {
  columnId: "origin",
  label: "Origen",
  options: INCOME_ORIGIN_OPTIONS,
} as const;

type IncomeTableProps = {
  /** `finance.manage`: sin él no hay alta, edición ni borrado en la UI (AC8). */
  canManage: boolean;
};

/** Frontera de cliente del libro de ingresos (015 T18 · 016 T17). */
export function IncomeTable({ canManage }: IncomeTableProps) {
  // El rango acota la consulta en el servidor (el ledger crece con cada pedido
  // pagado); el origen se filtra sobre el resultado ya cargado.
  const [range, setRange] = useState<LedgerRange>(EMPTY_RANGE);
  // `null` en el formulario es un alta; con fila, una edición.
  const [editing, setEditing] = useState<FinanceIncomeListItem | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<FinanceIncomeListItem | null>(null);

  const query = useFinanceIncome({
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const onEdit = useCallback((entry: FinanceIncomeListItem) => {
    setEditing(entry);
    setFormOpen(true);
  }, []);

  const columns = useMemo(
    () => buildIncomeColumns({ canManage, onEdit, onDelete: setDeleting }),
    [canManage, onEdit],
  );

  return (
    <>
      <LedgerTable
        columns={columns}
        query={query}
        originFilter={ORIGIN_FILTER}
        onApplyRange={setRange}
        errorTitle="No se pudieron cargar los ingresos"
        searchPlaceholder="Buscar por concepto..."
        emptyMessage="No hay ingresos para estos filtros."
        actions={
          canManage ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nuevo ingreso
            </Button>
          ) : null
        }
      />

      {canManage ? (
        <>
          <IncomeFormDialog
            open={isFormOpen}
            onOpenChange={setFormOpen}
            entry={editing}
          />

          <DeleteFinanceEntryDialog
            type="income"
            open={deleting !== null}
            onOpenChange={(open) => {
              if (!open) {
                setDeleting(null);
              }
            }}
            entry={deleting}
          />
        </>
      ) : null}
    </>
  );
}
