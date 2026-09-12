import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type AccountEmptySectionProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
} & (
  | {
      /** Texto del CTA al catálogo; el destino siempre es `/products`. */
      ctaLabel: string;
      action?: never;
    }
  | {
      /** Acción propia cuando el estado vacío no se resuelve navegando (010 AC1). */
      action: React.ReactNode;
      ctaLabel?: never;
    }
);

/**
 * Estado vacío de las pestañas de la cuenta (007 T4, AC5). No hace peticiones
 * de red: o lleva al catálogo o recibe ya montada la acción de su dominio.
 */
export function AccountEmptySection({
  icon,
  title,
  description,
  ctaLabel,
  action,
}: AccountEmptySectionProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        {action ?? (
          <Button asChild>
            <Link href="/products">{ctaLabel}</Link>
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
}
