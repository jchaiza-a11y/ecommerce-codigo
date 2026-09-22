import {
  PackageX,
  Receipt,
  ShoppingCart,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { formatUnits } from "@/modules/dashboard/constants";
import type { DashboardSummary } from "@/modules/dashboard/types/dashboard.types";
import { formatPrice } from "@/modules/products/constants";

type KpiCardsProps = {
  summary: DashboardSummary;
};

type Kpi = {
  key: keyof DashboardSummary;
  label: string;
  value: string;
  icon: LucideIcon;
};

/**
 * Fila de stat tiles del dashboard (011 T16, AC1). Presentacional puro: recibe
 * el resumen ya resuelto, no consulta el hook — de la carga y el error se
 * encarga el contenedor.
 */
export function KpiCards({ summary }: KpiCardsProps) {
  const kpis: Kpi[] = [
    {
      key: "salesCents",
      label: "Ventas",
      value: formatPrice(summary.salesCents),
      icon: TrendingUp,
    },
    {
      key: "orders",
      label: "Pedidos",
      value: formatUnits(summary.orders),
      icon: ShoppingCart,
    },
    {
      key: "averageTicketCents",
      label: "Ticket promedio",
      value: formatPrice(summary.averageTicketCents),
      icon: Receipt,
    },
    {
      key: "lowStockCount",
      label: "Stock bajo",
      value: formatUnits(summary.lowStockCount),
      icon: PackageX,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map(({ key, label, value, icon: Icon }) => (
        <Card key={key}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardAction>
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </CardAction>
          </CardHeader>
          <CardContent>
            {/* Cifras proporcionales a propósito: `tabular-nums` afloja los
                números grandes y aquí no hay columna con la que alinear. */}
            <p className="font-heading text-2xl font-semibold tracking-tight">
              {value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
