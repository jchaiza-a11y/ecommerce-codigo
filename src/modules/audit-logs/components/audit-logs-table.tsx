"use client";

import { useMemo, useState } from "react";

import { DataTable, type DataTableFilter } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildAuditLogColumns } from "@/modules/audit-logs/components/audit-log-columns";
import {
  AUDIT_ENTITY_OPTIONS,
  getAuditActionLabel,
} from "@/modules/audit-logs/constants";
import { useAuditLogs } from "@/modules/audit-logs/hooks/use-audit-logs";
import { getApiErrorMessage } from "@/modules/audit-logs/services/audit-log.service";
import type { AuditLogListItem } from "@/modules/audit-logs/types/audit-log.types";

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_LOGS: AuditLogListItem[] = [];

type DateRange = { from: string; to: string };

const EMPTY_RANGE: DateRange = { from: "", to: "" };

export function AuditLogsTable() {
  // El rango de fechas acota la consulta en el servidor (la tabla crece sin
  // fin); entidad, acción y actor se filtran sobre el resultado ya cargado.
  const [draftRange, setDraftRange] = useState<DateRange>(EMPTY_RANGE);
  const [appliedRange, setAppliedRange] = useState<DateRange>(EMPTY_RANGE);

  const { data, isPending, isError, error } = useAuditLogs({
    from: appliedRange.from || undefined,
    to: appliedRange.to || undefined,
  });

  const columns = useMemo(() => buildAuditLogColumns(), []);

  const filters = useMemo<DataTableFilter[]>(() => {
    const actions = [...new Set((data ?? []).map((log) => log.action))].sort();

    return [
      {
        columnId: "entityType",
        label: "Entidad",
        options: AUDIT_ENTITY_OPTIONS,
      },
      {
        columnId: "action",
        label: "Acción",
        options: actions.map((action) => ({
          label: getAuditActionLabel(action),
          value: action,
        })),
      },
    ];
  }, [data]);

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          No se pudo cargar la bitácora
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {getApiErrorMessage(error, "Inténtalo de nuevo en unos momentos.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedRange(draftRange);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">Desde</Label>
          <Input
            id="audit-from"
            type="date"
            className="w-44"
            value={draftRange.from}
            onChange={(event) =>
              setDraftRange((range) => ({ ...range, from: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">Hasta</Label>
          <Input
            id="audit-to"
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
            setAppliedRange(EMPTY_RANGE);
          }}
        >
          Limpiar
        </Button>
      </form>

      <DataTable
        columns={columns}
        data={data ?? EMPTY_LOGS}
        isLoading={isPending}
        searchPlaceholder="Buscar por actor o acción..."
        filters={filters}
        emptyMessage="No hay registros para estos filtros."
      />
    </div>
  );
}
