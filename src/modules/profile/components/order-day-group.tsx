import { CalendarDays, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { OrderDayGroup as DayGroup } from "@/modules/profile/lib/group-orders-by-day";
import { formatOrderTime } from "@/modules/profile/lib/group-orders-by-day";
import type { OrderHistoryItem } from "@/modules/profile/schemas/order-history.schema";
import { formatPrice } from "@/modules/products/constants";

type OrderDayGroupProps = {
  group: DayGroup;
  onSelect: (order: OrderHistoryItem) => void;
};

/** Los uuid no se enseñan enteros: los 8 primeros bastan para referenciarlo. */
function toOrderReference(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function countUnits(order: OrderHistoryItem): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

/** Cabecera de un día y las compras de esa jornada (AC1). */
export function OrderDayGroup({ group, onSelect }: OrderDayGroupProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium first-letter:uppercase">
          {group.label}
        </h3>
        <Separator className="flex-1" />
      </div>

      <div className="flex flex-col gap-3">
        {group.orders.map((order) => {
          const units = countUnits(order);

          return (
            <Card key={order.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"
                  >
                    <Package className="size-5 text-muted-foreground" />
                  </span>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      Pedido {toOrderReference(order.id)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatOrderTime(order.createdAt)} ·{" "}
                      {units === 1 ? "1 artículo" : `${units} artículos`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge variant="secondary">Pagado</Badge>
                  <span className="text-sm font-semibold">
                    {formatPrice(order.totalCents)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSelect(order)}
                  >
                    Ver detalle
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
