"use client";

import { CreditCard } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCardLabel } from "@/modules/profile/constants";
import type { SavedCard } from "@/modules/profile/schemas/saved-card.schema";

/**
 * Radix exige un `value` no vacío por opción, así que "usar otra tarjeta"
 * necesita un centinela; hacia fuera se traduce a `null`.
 */
const NEW_CARD_VALUE = "new-card";

const SELECT_ID = "checkout-saved-card";

type SavedCardPickerProps = {
  cards: readonly SavedCard[];
  /** `null` = pagar con una tarjeta nueva. */
  value: string | null;
  onChange: (savedCardId: string | null) => void;
  disabled?: boolean;
};

/**
 * Selector de tarjeta del carrito (010 T22). Presentacional: recibe las
 * tarjetas ya cargadas y solo comunica la elección.
 *
 * Elegir aquí decide **si** Checkout ofrece las guardadas, no cuál se cobra:
 * Stripe no admite preseleccionar una y prellena siempre la más reciente
 * (010 §Decisión 3), de ahí que el texto no prometa "se cobrará esta".
 */
export function SavedCardPicker({
  cards,
  value,
  onChange,
  disabled,
}: SavedCardPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={SELECT_ID} className="text-muted-foreground">
        <CreditCard className="size-4" />
        Tarjeta
      </Label>

      <Select
        value={value ?? NEW_CARD_VALUE}
        onValueChange={(next) =>
          onChange(next === NEW_CARD_VALUE ? null : next)
        }
        disabled={disabled}
      >
        <SelectTrigger id={SELECT_ID} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {cards.map((card) => (
            <SelectItem key={card.id} value={card.id}>
              {formatCardLabel(card)}
            </SelectItem>
          ))}
          <SelectItem value={NEW_CARD_VALUE}>Usar otra tarjeta</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
