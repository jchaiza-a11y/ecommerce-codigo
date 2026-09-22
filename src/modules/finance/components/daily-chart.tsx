"use client";

import { Activity } from "lucide-react";
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
// Reutilizado del dashboard (011): el bloque vacío de un gráfico de solo
// lectura es idéntico aquí, y clonarlo solo abriría una segunda versión.
import { DashboardEmpty } from "@/modules/dashboard/components/dashboard-empty";
import { RANGE_DAYS } from "@/modules/finance/constants";
import type { FinanceDailyPoint } from "@/modules/finance/types/finance.types";
import { formatPrice } from "@/modules/products/constants";

type DailyChartProps = {
  data: FinanceDailyPoint[];
};

/**
 * Dos series de identidad (ingreso vs. egreso), así que la paleta es
 * categórica: azul y naranja de la paleta validada, en su paso para cada modo
 * —no un volteo automático del claro—. Validadas contra las superficies reales
 * de la tarjeta (`#ffffff` claro, `#171717` oscuro): pasan banda de luminosidad,
 * piso de croma, separación CVD (ΔE 24,7 claro / 26,8 oscuro) y contraste ≥ 3:1.
 * Los tokens `--chart-*` del proyecto son grises sin croma y no pueden separar
 * dos identidades, por eso no se usan aquí.
 */
const chartConfig = {
  incomeCents: {
    label: "Ingresos",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
  expenseCents: {
    label: "Egresos",
    theme: { light: "#eb6834", dark: "#d95926" },
  },
} satisfies ChartConfig;

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

const SERIES = ["incomeCents", "expenseCents"] as const;

/**
 * Evolución diaria de ingresos y egresos (015 T14, AC5).
 *
 * Un solo eje Y y dos líneas superpuestas: a diferencia del dashboard, las dos
 * series comparten unidad (centavos), así que comparten escala sin imponer
 * ninguna alineación arbitraria. Con dos series la leyenda es obligatoria —la
 * identidad nunca depende solo del color—, y el cursor del tooltip da los dos
 * valores del mismo día.
 */
export function DailyChart({ data }: DailyChartProps) {
  const hasActivity = data.some(
    (day) => day.incomeCents > 0 || day.expenseCents > 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución diaria</CardTitle>
        <CardDescription>
          Ingresos y egresos de los últimos {RANGE_DAYS} días
        </CardDescription>
      </CardHeader>

      <CardContent>
        {hasActivity ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-72 w-full"
          >
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
                tickFormatter={(value: number) => formatPrice(value)}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "" }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label) =>
                      tooltipDateFormatter.format(toUtcDate(String(label)))
                    }
                    formatter={(value, name) => (
                      <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                        <span className="text-muted-foreground">
                          {chartConfig[name as keyof typeof chartConfig].label}
                        </span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {formatPrice(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {SERIES.map((series) => (
                <Line
                  key={series}
                  dataKey={series}
                  type="monotone"
                  stroke={`var(--color-${series})`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  // Anillo de 2px en el color de la superficie: mantiene legible
                  // el punto activo donde las dos líneas se cruzan.
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        ) : (
          <DashboardEmpty
            icon={Activity}
            title="Sin movimientos en el periodo"
            description={`No hay ingresos ni egresos registrados en los últimos ${RANGE_DAYS} días, así que no hay evolución que dibujar.`}
          />
        )}
      </CardContent>
    </Card>
  );
}
