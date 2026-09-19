"use client";

import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { AdminOrderDetailDialog } from "@/modules/orders/components/admin-order-detail-dialog";
import { AdminOrderFilters } from "@/modules/orders/components/admin-order-filters";
import { buildAdminOrderColumns } from "@/modules/orders/components/admin-order-columns";
import {
  ADMIN_ORDER_LIMIT,
  EMPTY_ADMIN_ORDER_DRAFT,
  toAdminOrderQuery,
  type AdminOrderFilterDraft,
} from "@/modules/orders/constants";
import { useAdminOrders } from "@/modules/orders/hooks/use-admin-orders";
import type { AdminOrderListItem } from "@/modules/orders/schemas/admin-order.schema";

// Referencia estable: un array nuevo por render invalidaría los row models.
const EMPTY_ORDERS: AdminOrderListItem[] = [];

/**
 * Frontera de cliente de `/admin/orders`: concentra el estado de los filtros y
 * el pedido abierto. Los tres filtros viajan al servidor, así que la barra
 * propia sustituye a los `filters` de `DataTable` (exact-match, incapaces de
 * expresar un rango) — a `DataTable` le queda el orden y la paginación de la
 * página ya filtrada.
 */
export function AdminOrdersTable() {
  const [draft, setDraft] = useState<AdminOrderFilterDraft>(
    EMPTY_ADMIN_ORDER_DRAFT,
  );
  const [applied, setApplied] = useState<AdminOrderFilterDraft>(
    EMPTY_ADMIN_ORDER_DRAFT,
  );
  const [selected, setSelected] = useState<AdminOrderListItem | null>(null);

  const query = useMemo(() => toAdminOrderQuery(applied), [applied]);
  const ordersQuery = useAdminOrders(query);

  const columns = useMemo(
    () => buildAdminOrderColumns({ onSelect: setSelected }),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <AdminOrderFilters
        draft={draft}
        onDraftChange={setDraft}
        onApply={() => setApplied(draft)}
        onClear={() => {
          setDraft(EMPTY_ADMIN_ORDER_DRAFT);
          setApplied(EMPTY_ADMIN_ORDER_DRAFT);
        }}
        isApplying={ordersQuery.isFetching}
      />

      {ordersQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">
            No se pudieron cargar los pedidos
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getApiErrorMessage(
              ordersQuery.error,
              "Inténtalo de nuevo en unos momentos.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => ordersQuery.refetch()}
            disabled={ordersQuery.isFetching}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {/* AC8: alcanzar el tope no prueba que falten pedidos, pero sí que
              pueden faltar. Se pide acotar el periodo en vez de mentir. */}
          {ordersQuery.data?.truncated ? (
            <p className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              Se muestran los {ADMIN_ORDER_LIMIT} pedidos más recientes del
              periodo. Acota las fechas o filtra por estado o cliente para ver
              el resto.
            </p>
          ) : null}

          <DataTable
            columns={columns}
            data={ordersQuery.data?.items ?? EMPTY_ORDERS}
            isLoading={ordersQuery.isPending}
            searchPlaceholder="Buscar por cliente..."
            emptyMessage="No hay pedidos para estos filtros."
          />
        </>
      )}

      <AdminOrderDetailDialog
        order={selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
      />
    </div>
  );
}
