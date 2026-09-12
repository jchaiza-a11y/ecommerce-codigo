"use client";

import { useMemo, useState } from "react";
import { Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { AccountEmptySection } from "@/modules/profile/components/account-empty-section";
import { OrderDayGroup } from "@/modules/profile/components/order-day-group";
import { OrderDetailDialog } from "@/modules/profile/components/order-detail-dialog";
import { OrderHistoryFilter } from "@/modules/profile/components/order-history-filter";
import type { DateInputRange, OrderRangeMode } from "@/modules/profile/constants";
import {
  getCurrentMonthDateInputs,
  getCurrentMonthRange,
  toRangeFromDateInputs,
} from "@/modules/profile/constants";
import { useOrderHistory } from "@/modules/profile/hooks/use-order-history";
import { groupOrdersByDay } from "@/modules/profile/lib/group-orders-by-day";
import type { OrderHistoryItem } from "@/modules/profile/schemas/order-history.schema";

const EMPTY_DRAFT: DateInputRange = { from: "", to: "" };

function OrderHistorySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/**
 * Frontera de cliente de "Mis compras" (009 T14): concentra el estado del
 * filtro y el pedido abierto; el resto de piezas son presentacionales.
 *
 * El rango inicial se calcula aquí y no en el servidor porque "mes actual"
 * depende de la zona horaria del navegador (009 §API).
 */
export function OrderHistorySection() {
  const [mode, setMode] = useState<OrderRangeMode>("current-month");
  const [draft, setDraft] = useState<DateInputRange>(EMPTY_DRAFT);
  const [range, setRange] = useState(() => getCurrentMonthRange());
  const [selected, setSelected] = useState<OrderHistoryItem | null>(null);

  const historyQuery = useOrderHistory(range);

  // AC3: un rango rechazado no debe vaciar la pantalla. `keepPreviousData` solo
  // cubre la espera; en cuanto la query pasa a `error` se queda sin datos, así
  // que el último listado bueno se retiene aquí. Ajuste de estado en render
  // (no en efecto): converge en el mismo commit y no encadena repintados.
  const [lastLoaded, setLastLoaded] = useState<OrderHistoryItem[] | null>(null);

  if (historyQuery.data && historyQuery.data !== lastLoaded) {
    setLastLoaded(historyQuery.data);
  }

  const items = historyQuery.data ?? lastLoaded;
  const groups = useMemo(() => groupOrdersByDay(items ?? []), [items]);

  const changeMode = (next: OrderRangeMode) => {
    setMode(next);

    if (next === "current-month") {
      setDraft(EMPTY_DRAFT);
      setRange(getCurrentMonthRange());
      return;
    }

    // Los días del mes en curso como punto de partida del formulario. Se
    // rellenan aquí y no en el estado inicial para no depender de la fecha
    // del servidor durante la hidratación.
    setDraft(getCurrentMonthDateInputs());
  };

  const applyDraft = () => {
    const nextRange = toRangeFromDateInputs(draft);

    if (nextRange) {
      setRange(nextRange);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <OrderHistoryFilter
        mode={mode}
        onModeChange={changeMode}
        draft={draft}
        onDraftChange={setDraft}
        onApply={applyDraft}
        isApplying={historyQuery.isFetching}
      />

      {historyQuery.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">
            No se pudo cargar tu historial
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {getApiErrorMessage(
              historyQuery.error,
              "Inténtalo de nuevo en unos momentos.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => historyQuery.refetch()}
            disabled={historyQuery.isFetching}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {historyQuery.isPending ? <OrderHistorySkeleton /> : null}

      {!historyQuery.isPending && items && groups.length === 0 ? (
        <AccountEmptySection
          icon={<Package />}
          title="No hay compras en este periodo"
          description="Prueba con otro rango de fechas o descubre lo último del catálogo."
          ctaLabel="Ver productos"
        />
      ) : null}

      {groups.length > 0 ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <OrderDayGroup
              key={group.key}
              group={group}
              onSelect={setSelected}
            />
          ))}
        </div>
      ) : null}

      <OrderDetailDialog
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
