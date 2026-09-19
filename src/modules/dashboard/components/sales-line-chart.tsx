"use client";

import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DashboardEmpty } from "@/modules/dashboard/components/dashboard-empty";
import { formatUnits, RANGE_DAYS } from "@/modules/dashboard/constants";
import type { DailyMetric } from "@/modules/dashboard/types/dashboard.types";
import { formatPrice } from "@/modules/products/constants";

type SalesLineChartProps = {
  data: DailyMetric[];
};

/**
 * Serie única por facet: cada gráfico pinta una sola línea, así que no hay
 * identidad que separar por color y basta el token del panel, que ya invierte
 * por tema (claro 16:1, oscuro 13:1 contra la superficie de la tarjeta). Los
 * tokens `--chart-*` del proyecto son grises sin croma y quedan por debajo de
 * 3:1 en algún modo (`--chart-1` 1.48:1 en claro, `--chart-3` 2.29:1 en
 * oscuro), por eso no se usan aquí.
 */
const chartConfig = {
  salesCents: { label: "Ventas", color: "var(--primary)" },
  orders: { label: "Pedidos", color: "var(--primary)" },
} satisfies ChartConfig;

/**
 * Ancho fijo y común a los dos ejes Y: es lo que mantiene alineadas las áreas
 * de dibujo de ambos facets, y sin esa alineación un mismo día caería en dos
 * posiciones X distintas y los gráficos dejarían de ser comparables.
 */
const Y_AXIS_WIDTH = 92;

const axisDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const tooltipDateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
  timeZone: "UTC",
});

/** El repositorio agrupa por día UTC; el formateo debe leerlo en UTC también. */
function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

type SeriesFacetProps = {
  title: string;
  data: DailyMetric[];
  dataKey: "salesCents" | "orders";
  formatValue: (value: number) => string;
};

function SeriesFacet({ title, data, dataKey, formatValue }: SeriesFacetProps) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium text-muted-foreground">
        {title}
      </figcaption>

      <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0 }}>
          {/* Sólida, no punteada: una rejilla discontinua se lee como umbral. */}
          <CartesianGrid vertical={false} strokeDasharray="" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(day: string) =>
              axisDateFormatter.format(toUtcDate(day))
            }
          />
          <YAxis
            width={Y_AXIS_WIDTH}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            tickFormatter={formatValue}
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "" }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) =>
                  tooltipDateFormatter.format(toUtcDate(String(label)))
                }
                formatter={(value) => (
                  <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                    <span className="text-muted-foreground">{title}</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatValue(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Line
            dataKey={dataKey}
            type="monotone"
            stroke={`var(--color-${dataKey})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            // Anillo de 2px en el color de la superficie: mantiene legible el
            // punto activo donde cruza la propia línea.
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </LineChart>
      </ChartContainer>
    </figure>
  );
}

/**
 * Evolución diaria de ventas y pedidos (011 T17, AC3).
 *
 * Dos facets apilados y NO un eje Y doble: centavos y unidades son magnitudes
 * distintas y superponerlas en un plano obliga a elegir una alineación
 * arbitraria entre escalas, que el lector interpreta como correlación. Cada
 * serie conserva su propio eje, y el eje X compartido deja la comparación
 * temporal intacta. Una sola serie por facet, así que no hay leyenda: el
 * epígrafe ya dice qué se pinta.
 */
export function SalesLineChart({ data }: SalesLineChartProps) {
  const hasActivity = data.some(
    (day) => day.salesCents > 0 || day.orders > 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución diaria</CardTitle>
        <CardDescription>
          Ventas y pedidos de los últimos {RANGE_DAYS} días
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {hasActivity ? (
          <>
            <SeriesFacet
              title="Ventas"
              data={data}
              dataKey="salesCents"
              formatValue={formatPrice}
            />
            <SeriesFacet
              title="Pedidos"
              data={data}
              dataKey="orders"
              formatValue={formatUnits}
            />
          </>
        ) : (
          <DashboardEmpty
            icon={TrendingUp}
            title="Sin ventas en el periodo"
            description={`No hay pedidos pagados en los últimos ${RANGE_DAYS} días, así que no hay evolución que dibujar.`}
          />
        )}
      </CardContent>
    </Card>
  );
}
