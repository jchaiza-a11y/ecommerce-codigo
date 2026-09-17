"use client";

import { PackageX } from "lucide-react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

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
import type { TopProduct } from "@/modules/dashboard/types/dashboard.types";
import { formatPrice } from "@/modules/products/constants";

type TopProductsChartProps = {
  data: TopProduct[];
};

/**
 * Un único color para todas las barras. Teñir cada barra según su tamaño
 * duplicaría en el tono lo que la longitud ya dice, y "producto" no es una
 * categoría con orden natural que justifique una rampa.
 */
const chartConfig = {
  units: { label: "Unidades", color: "var(--primary)" },
} satisfies ChartConfig;

const ROW_HEIGHT = 36;
/** Margen inferior del área de dibujo; el eje X va oculto y no reserva banda. */
const PLOT_PADDING = 24;
const NAME_MAX_CHARS = 26;

function truncateName(name: string): string {
  return name.length > NAME_MAX_CHARS
    ? `${name.slice(0, NAME_MAX_CHARS - 1)}…`
    : name;
}

/**
 * Top de productos por unidades vendidas (011 T18).
 *
 * Barras horizontales: los nombres de producto son largos y en columnas
 * verticales se solapan o hay que rotarlos. `units` dimensiona y ordena la
 * barra — es la magnitud del spec —; `salesCents` viaja en el tooltip porque
 * es un segundo dato del mismo producto, no una segunda serie.
 */
export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos más vendidos</CardTitle>
        <CardDescription>
          Unidades vendidas en los últimos {RANGE_DAYS} días
        </CardDescription>
      </CardHeader>

      <CardContent>
        {data.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: data.length * ROW_HEIGHT + PLOT_PADDING }}
          >
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              // Hueco a la derecha para la etiqueta de valor en la punta.
              margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
            >
              {/* Cada barra lleva su valor rotulado, así que el eje de valores
                  no aporta nada y solo añade tinta. */}
              <XAxis type="number" dataKey="units" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={truncateName}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_label, payload) => {
                      const product = payload?.[0]?.payload as
                        | TopProduct
                        | undefined;
                      return product?.name ?? "";
                    }}
                    formatter={(value, _name, item) => {
                      const product = item.payload as TopProduct;
                      return (
                        <div className="flex flex-1 flex-col gap-1 leading-none">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              Unidades
                            </span>
                            <span className="font-mono font-medium text-foreground tabular-nums">
                              {formatUnits(Number(value))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              Ventas
                            </span>
                            <span className="font-mono font-medium text-foreground tabular-nums">
                              {formatPrice(product.salesCents)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="units"
                fill="var(--color-units)"
                // Punta redondeada, cuadrada contra la línea base.
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              >
                <LabelList
                  dataKey="units"
                  position="right"
                  offset={8}
                  className="fill-foreground"
                  fontSize={12}
                  formatter={(label) =>
                    typeof label === "number" ? formatUnits(label) : ""
                  }
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <DashboardEmpty
            icon={PackageX}
            title="Sin productos vendidos"
            description={`Ningún pedido pagado en los últimos ${RANGE_DAYS} días incluye productos.`}
          />
        )}
      </CardContent>
    </Card>
  );
}
