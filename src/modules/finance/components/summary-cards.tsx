import {
  Landmark,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercent, RANGE_DAYS } from "@/modules/finance/constants";
import { IGV_RATE } from "@/modules/finance/lib/igv";
import type { FinanceSummary } from "@/modules/finance/types/finance.types";
import { formatPrice } from "@/modules/products/constants";

type SummaryCardsProps = {
  summary: FinanceSummary;
};

type Kpi = {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  /** Solo la ganancia neta cambia de tinta, y solo cuando es negativa. */
  negative?: boolean;
};

const igvPercentLabel = formatPercent(IGV_RATE * 100);

/**
 * KPIs del resumen financiero (015 T13, AC2). Presentacional puro: recibe el
 * resumen ya resuelto, no consulta el hook — de la carga y el error se encarga
 * el contenedor.
 */
export function SummaryCards({ summary }: SummaryCardsProps) {
  const kpis: Kpi[] = [
    {
      key: "income",
      label: `Ingresos (${RANGE_DAYS} días)`,
      value: formatPrice(summary.incomeCents),
      detail: "Cobrado en pedidos pagados y altas manuales.",
      icon: TrendingUp,
    },
    {
      key: "expense",
      label: "Egresos",
      value: formatPrice(summary.expenseCents.total),
      detail: `Costo de venta ${formatPrice(summary.expenseCents.cogs)} · Envío ${formatPrice(summary.expenseCents.shipping)}`,
      icon: TrendingDown,
    },
    {
      key: "igv",
      label: `IGV incluido (${igvPercentLabel})`,
      value: formatPrice(summary.igvCents),
      detail: "Informativo: ya viene dentro del precio y no resta ganancia.",
      icon: Landmark,
    },
    {
      key: "netProfit",
      label: "Ganancia neta",
      value: formatPrice(summary.netProfitCents),
      detail: "Ingresos menos egresos del periodo.",
      icon: PiggyBank,
      negative: summary.netProfitCents < 0,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ key, label, value, detail, icon: Icon, negative }) => (
          <Card key={key}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardAction>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* Cifras proporcionales a propósito: `tabular-nums` afloja los
                  números grandes y aquí no hay columna con la que alinear. */}
              <p
                className={cn(
                  "font-heading text-2xl font-semibold tracking-tight",
                  negative && "text-destructive",
                )}
              >
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <CostCoverageNotice coverage={summary.costCoverage} />
    </div>
  );
}

/**
 * Aviso de cobertura de costeo (AC3): sin él, un COGS bajo por productos sin
 * costear se lee como margen alto. Solo aparece cuando hay venta descubierta.
 */
function CostCoverageNotice({
  coverage,
}: {
  coverage: FinanceSummary["costCoverage"];
}) {
  if (coverage.excludedSalesCents <= 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4"
    >
      <TriangleAlert
        className="mt-0.5 size-4 shrink-0 text-amber-600"
        aria-hidden
      />
      <div className="text-sm">
        <p className="font-medium">
          Costeo incompleto: {formatPercent(coverage.coveragePct)} de la venta
          tiene costo registrado
        </p>
        <p className="mt-1 text-muted-foreground">
          {formatPrice(coverage.excludedSalesCents)} de venta salió de productos
          sin costo: el costo de venta queda por debajo del real y la ganancia
          neta, por encima. Registra el costo de esos productos para cerrar la
          brecha.
        </p>
      </div>
    </div>
  );
}
