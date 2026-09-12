"use client";

import { useEffect, useState } from "react";

import { useIsMounted } from "@/hooks/use-is-mounted";

function millisecondsToEndOfDay(): number {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return endOfDay.getTime() - Date.now();
}

function toSegments(remainingMs: number): { label: string; value: string }[] {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    { label: "h", value: pad(Math.floor(totalSeconds / 3600)) },
    { label: "m", value: pad(Math.floor((totalSeconds % 3600) / 60)) },
    { label: "s", value: pad(totalSeconds % 60) },
  ];
}

/**
 * Cuenta atrás **cosmética** (004 §8.1b): `products` no tiene ninguna columna
 * de fin de oferta, así que esto no expira nada — cuenta hasta el final del día
 * local. Cuando exista `deal_ends_at` en BD, la fecha vendrá por props.
 */
export function DealsCountdown() {
  const [remainingMs, setRemainingMs] = useState(millisecondsToEndOfDay);
  // El reloj del servidor y el del visitante no coinciden: hasta que el
  // componente está montado en cliente se pintan guiones, no cifras.
  const isMounted = useIsMounted();

  useEffect(() => {
    const timer = setInterval(
      () => setRemainingMs(millisecondsToEndOfDay()),
      1000,
    );

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label="Tiempo restante de las ofertas de hoy"
    >
      {toSegments(remainingMs).map((segment) => (
        <span
          key={segment.label}
          className="flex min-w-11 items-baseline justify-center gap-0.5 rounded-lg bg-foreground px-2 py-1 font-heading text-sm font-semibold text-background tabular-nums"
        >
          {isMounted ? segment.value : "--"}
          <span className="text-[10px] font-normal opacity-70">
            {segment.label}
          </span>
        </span>
      ))}
    </div>
  );
}
