"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` en servidor y en el render de hidratación, `true` después. Resuelve
 * el patrón "solo en cliente" sin un `setState` dentro de un efecto, que
 * dispara un render en cascada y está prohibido por el linter de React.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
