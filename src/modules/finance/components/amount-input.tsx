"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { centsToUnits, unitsToCents } from "@/modules/products/constants";

type AmountInputProps = {
  id: string;
  name: string;
  value: number | null | undefined;
  invalid: boolean;
  onChange: (cents: number | null) => void;
  onBlur: () => void;
};

/**
 * Importe en unidades con decimales sobre un campo que guarda centavos enteros
 * (CLAUDE.md §6). Lo comparten los diálogos de ingreso y de egreso manual, que
 * solo difieren en su categoría.
 *
 * El texto se mantiene tal y como se teclea: derivarlo del número en cada
 * pulsación haría imposible escribir "1299." camino de "1299,99".
 */
export function AmountInput({
  id,
  name,
  value,
  invalid,
  onChange,
  onBlur,
}: AmountInputProps) {
  const [text, setText] = useState(() =>
    typeof value === "number" ? centsToUnits(value).toFixed(2) : "",
  );

  return (
    <Input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      aria-invalid={invalid}
      value={text}
      onBlur={onBlur}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);

        const normalized = raw.trim().replace(",", ".");

        if (normalized === "") {
          onChange(null);
          return;
        }

        const units = Number(normalized);
        // `NaN` deja que Zod marque el campo en vez de guardar un valor falso.
        onChange(Number.isFinite(units) ? unitsToCents(units) : Number.NaN);
      }}
    />
  );
}
