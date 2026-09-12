"use client";

import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STOREFRONT_SORTS,
  type StorefrontSort,
} from "@/modules/storefront/schemas/catalog.schema";

const SORT_LABELS: Record<StorefrontSort, string> = {
  newest: "Novedades",
  price_asc: "Precio: de menor a mayor",
  price_desc: "Precio: de mayor a menor",
  discount: "Mayor descuento",
};

type CatalogSortProps = {
  value: StorefrontSort;
  onChange: (sort: StorefrontSort) => void;
};

export function CatalogSort({ value, onChange }: CatalogSortProps) {
  const labelId = useId();

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-sm text-muted-foreground">
        Ordenar por
      </span>
      <Select
        value={value}
        // Radix devuelve `string`; el `find` estrecha al union sin castear.
        onValueChange={(next) => {
          const sort = STOREFRONT_SORTS.find((option) => option === next);

          if (sort) onChange(sort);
        }}
      >
        <SelectTrigger aria-labelledby={labelId} className="min-w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STOREFRONT_SORTS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
