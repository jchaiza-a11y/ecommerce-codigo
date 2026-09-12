"use client";

import { useEffect, useState } from "react";

/**
 * Retrasa la propagación de un valor hasta que deja de cambiar durante
 * `delayMs`. El `clearTimeout` del cleanup es lo que colapsa una ráfaga de
 * pulsaciones en una sola actualización.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
