import type { LucideIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type DashboardEmptyProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/**
 * Estado vacío de los tres bloques con datos del dashboard (011 AC9): gráfico
 * de línea, barras de top productos y lista de stock bajo.
 *
 * No reutiliza `AccountEmptySection` a propósito: aquel contrato obliga a
 * `ctaLabel` o `action`, y el dashboard es de solo lectura — no hay acción que
 * ofrecer cuando no hay ventas.
 */
export function DashboardEmpty({
  icon: Icon,
  title,
  description,
}: DashboardEmptyProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
