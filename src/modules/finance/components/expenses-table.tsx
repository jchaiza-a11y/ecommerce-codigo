"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeleteFinanceEntryDialog } from "@/modules/finance/components/delete-entry-dialog";
import { buildExpenseColumns } from "@/modules/finance/components/expense-columns";
import { ExpenseFormDialog } from "@/modules/finance/components/expense-form-dialog";
import {
  EMPTY_RANGE,
  LedgerTable,
  type LedgerRange,
} from "@/modules/finance/components/ledger-table";
import { EXPENSE_ORIGIN_OPTIONS } from "@/modules/finance/constants";
import { useFinanceExpenses } from "@/modules/finance/hooks/use-finance-expenses";
import type { FinanceExpenseListItem } from "@/modules/finance/types/finance.types";

const ORIGIN_FILTER = {
  columnId: "origin",
  label: "Origen",
  options: EXPENSE_ORIGIN_OPTIONS,
} as const;

type ExpensesTableProps = {
  /** `finance.manage`: sin él no hay alta, edición ni borrado en la UI (AC8). */
  canManage: boolean;
};

/** Frontera de cliente del libro de egresos (015 T19 · 016 T18). */
export function ExpensesTable({ canManage }: ExpensesTableProps) {
  // El rango acota la consulta en el servidor (el ledger crece con cada pedido
  // pagado); el origen se filtra sobre el resultado ya cargado.
  const [range, setRange] = useState<LedgerRange>(EMPTY_RANGE);
  // `null` en el formulario es un alta; con fila, una edición.
  const [editing, setEditing] = useState<FinanceExpenseListItem | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<FinanceExpenseListItem | null>(null);

  const query = useFinanceExpenses({
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const onEdit = useCallback((entry: FinanceExpenseListItem) => {
    setEditing(entry);
    setFormOpen(true);
  }, []);

  const columns = useMemo(
    () => buildExpenseColumns({ canManage, onEdit, onDelete: setDeleting }),
    [canManage, onEdit],
  );

  return (
    <>
      <LedgerTable
        columns={columns}
        query={query}
        originFilter={ORIGIN_FILTER}
        onApplyRange={setRange}
        errorTitle="No se pudieron cargar los egresos"
        searchPlaceholder="Buscar por concepto..."
        emptyMessage="No hay egresos para estos filtros."
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
              Nuevo egreso
            </Button>
          ) : null
        }
      />

      {canManage ? (
        <>
          <ExpenseFormDialog
            open={isFormOpen}
            onOpenChange={setFormOpen}
            entry={editing}
          />

          <DeleteFinanceEntryDialog
            type="expense"
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
