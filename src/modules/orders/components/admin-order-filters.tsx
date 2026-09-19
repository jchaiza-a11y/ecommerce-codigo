import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORDER_STATUS_OPTIONS,
  type AdminOrderFilterDraft,
} from "@/modules/orders/constants";

// Radix Select no admite un item con `value` vacío: "todos" necesita un
// centinela que no pueda colisionar con un estado real.
const ALL_STATUSES = "__all__";

type AdminOrderFiltersProps = {
  draft: AdminOrderFilterDraft;
  onDraftChange: (draft: AdminOrderFilterDraft) => void;
  onApply: () => void;
  onClear: () => void;
  isApplying: boolean;
};

/**
 * Barra `draft`/`applied`: nada viaja hasta pulsar "Aplicar". Presentacional
 * pura, el estado vive en `AdminOrdersTable`.
 *
 * Dos `input[type=date]` en vez del `calendar` de shadcn, que arrastraría
 * `react-day-picker` para cubrir exactamente lo mismo (012 §Reutilizar).
 */
export function AdminOrderFilters({
  draft,
  onDraftChange,
  onApply,
  onClear,
  isApplying,
}: AdminOrderFiltersProps) {
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-orders-from">Desde</Label>
        <Input
          id="admin-orders-from"
          type="date"
          className="w-44"
          value={draft.from}
          max={draft.to || undefined}
          onChange={(event) =>
            onDraftChange({ ...draft, from: event.target.value })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-orders-to">Hasta</Label>
        <Input
          id="admin-orders-to"
          type="date"
          className="w-44"
          value={draft.to}
          min={draft.from || undefined}
          onChange={(event) =>
            onDraftChange({ ...draft, to: event.target.value })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-orders-status">Estado</Label>
        <Select
          value={draft.status === "" ? ALL_STATUSES : draft.status}
          onValueChange={(value) =>
            onDraftChange({
              ...draft,
              status: value === ALL_STATUSES ? "" : value,
            })
          }
        >
          <SelectTrigger id="admin-orders-status" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>Todos</SelectItem>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-orders-customer">Cliente</Label>
        <Input
          id="admin-orders-customer"
          type="search"
          className="w-56"
          placeholder="Nombre o email"
          maxLength={120}
          value={draft.customer}
          onChange={(event) =>
            onDraftChange({ ...draft, customer: event.target.value })
          }
        />
      </div>

      <Button type="submit" variant="outline" disabled={isApplying}>
        Aplicar
      </Button>

      <Button type="button" variant="ghost" onClick={onClear}>
        Limpiar
      </Button>
    </form>
  );
}
