"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { FileJson } from "lucide-react";

import type { DataTableFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AUDIT_SEVERITY_LABELS,
  formatDateTime,
  getAuditActionLabel,
} from "@/modules/audit-logs/constants";
import type {
  AuditLogListItem,
  AuditSeverity,
} from "@/modules/audit-logs/types/audit-log.types";

const helper = createColumnHelper<DataTableFeatures, AuditLogListItem>();

const SEVERITY_VARIANT: Record<
  AuditSeverity,
  "secondary" | "default" | "destructive"
> = {
  info: "secondary",
  warning: "default",
  error: "destructive",
};

function ChangesPopover({ log }: { log: AuditLogListItem }) {
  if (!log.changes) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2">
          <FileJson className="size-3.5" />
          Ver cambios
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <p className="text-sm font-medium">Antes y después</p>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(log.changes, null, 2)}
        </pre>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Columnas de solo lectura: `audit_logs` es append-only, así que la tabla no
 * ofrece ninguna acción de edición ni de borrado (SETUP.md §5.2).
 */
export function buildAuditLogColumns() {
  return helper.columns([
    helper.accessor("createdAt", {
      header: "Fecha",
      enableGlobalFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
    helper.accessor((row) => row.actorName ?? row.actorEmail ?? "Sistema", {
      id: "actor",
      header: "Actor",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    helper.accessor("action", {
      header: "Acción",
      filterFn: (row, columnId, filterValue) =>
        row.getValue(columnId) === filterValue,
      cell: (info) => getAuditActionLabel(info.getValue()),
    }),
    helper.accessor("entityType", {
      header: "Entidad",
      filterFn: (row, columnId, filterValue) =>
        row.getValue(columnId) === filterValue,
      cell: (info) => (
        <code className="text-xs text-muted-foreground">{info.getValue()}</code>
      ),
    }),
    helper.accessor("severity", {
      header: "Severidad",
      enableGlobalFilter: false,
      enableSorting: false,
      cell: (info) => (
        <Badge variant={SEVERITY_VARIANT[info.getValue()]}>
          {AUDIT_SEVERITY_LABELS[info.getValue()]}
        </Badge>
      ),
    }),
    helper.display({
      id: "changes",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ChangesPopover log={row.original} />
        </div>
      ),
    }),
  ]);
}
