"use client";

import { useId, useState } from "react";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ColumnDef, RowData } from "@tanstack/react-table";

import {
  DataTable,
  type DataTableFeatures,
  type DataTableFilter,
} from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinanceError } from "@/modules/finance/components/finance-error";

/** Rango tal y como lo escribe el usuario: `YYYY-MM-DD` o vacío. */
export type LedgerRange = { from: string; to: string };

export const EMPTY_RANGE: LedgerRange = { from: "", to: "" };

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_ROWS: never[] = [];

type LedgerTableProps<TData extends RowData> = {
  columns: Array<ColumnDef<DataTableFeatures, TData>>;
  query: UseQueryResult<TData[]>;
  /** Opciones del filtro por origen; el resto de columnas no se filtra. */
  originFilter: DataTableFilter;
  onApplyRange: (range: LedgerRange) => void;
  errorTitle: string;
  searchPlaceholder: string;
  emptyMessage: string;
};

/**
 * Armazón común de los dos listados del ledger (015 T18/T19): rango de fechas
 * aplicado en el servidor, aviso de error con reintento y `DataTable` para
 * búsqueda, filtro por columna, orden y paginación.
 *
 * Ingresos y egresos solo difieren en columnas, hook y textos, así que el
 * comportamiento vive aquí una vez y cada listado aporta lo suyo por props.
 * El rango **aplicado** lo guarda el llamador porque es parte de la clave de su
 * query; aquí solo vive el borrador del formulario.
 */
export function LedgerTable<TData extends RowData>({
  columns,
  query,
  originFilter,
  onApplyRange,
  errorTitle,
  searchPlaceholder,
  emptyMessage,
}: LedgerTableProps<TData>) {
  const [draftRange, setDraftRange] = useState<LedgerRange>(EMPTY_RANGE);
  const fieldId = useId();

  if (query.isError) {
    return (
      <FinanceError
        title={errorTitle}
        error={query.error}
        onRetry={() => query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onApplyRange(draftRange);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-from`}>Desde</Label>
          <Input
            id={`${fieldId}-from`}
            type="date"
            className="w-44"
            value={draftRange.from}
            onChange={(event) =>
              setDraftRange((range) => ({ ...range, from: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-to`}>Hasta</Label>
          <Input
            id={`${fieldId}-to`}
            type="date"
            className="w-44"
            value={draftRange.to}
            onChange={(event) =>
              setDraftRange((range) => ({ ...range, to: event.target.value }))
            }
          />
        </div>

        <Button type="submit" variant="outline">
          Aplicar fechas
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDraftRange(EMPTY_RANGE);
            onApplyRange(EMPTY_RANGE);
          }}
        >
          Limpiar
        </Button>
      </form>

      <DataTable
        columns={columns}
        data={query.data ?? EMPTY_ROWS}
        isLoading={query.isPending}
        searchPlaceholder={searchPlaceholder}
        filters={[originFilter]}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
