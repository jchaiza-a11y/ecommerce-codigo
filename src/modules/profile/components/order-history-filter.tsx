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
import type { DateInputRange, OrderRangeMode } from "@/modules/profile/constants";
import { ORDER_RANGE_MODES } from "@/modules/profile/constants";

type OrderHistoryFilterProps = {
  mode: OrderRangeMode;
  onModeChange: (mode: OrderRangeMode) => void;
  draft: DateInputRange;
  onDraftChange: (draft: DateInputRange) => void;
  onApply: () => void;
  isApplying: boolean;
};

/**
 * Presentacional puro: el estado del filtro vive en `OrderHistorySection`. Dos
 * `input[type=date]` en vez de un `calendar` de shadcn, que arrastraría
 * `react-day-picker` para cubrir exactamente lo mismo (009 §Reutilizar).
 */
export function OrderHistoryFilter({
  mode,
  onModeChange,
  draft,
  onDraftChange,
  onApply,
  isApplying,
}: OrderHistoryFilterProps) {
  const isCustom = mode === "custom";

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-range-mode">Periodo</Label>
        <Select
          value={mode}
          onValueChange={(value) => onModeChange(value as OrderRangeMode)}
        >
          <SelectTrigger id="order-range-mode" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_RANGE_MODES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustom ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-range-from">Desde</Label>
            <Input
              id="order-range-from"
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
            <Label htmlFor="order-range-to">Hasta</Label>
            <Input
              id="order-range-to"
              type="date"
              className="w-44"
              value={draft.to}
              onChange={(event) =>
                onDraftChange({ ...draft, to: event.target.value })
              }
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            disabled={isApplying || !draft.from || !draft.to}
          >
            Aplicar
          </Button>
        </>
      ) : null}
    </form>
  );
}
