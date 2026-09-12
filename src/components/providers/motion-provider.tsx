"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/**
 * `reducedMotion="user"` desactiva de golpe todas las animaciones de `motion`
 * cuando el sistema pide movimiento reducido (AC9), sin repetir la consulta de
 * medios en cada componente animado.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
