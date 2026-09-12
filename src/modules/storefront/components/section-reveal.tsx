"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type SectionRevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

/**
 * Reveal de sección reutilizable. Solo anima `opacity` y `transform` (§8.8) y
 * usa `once` para que el contenido no vuelva a desvanecerse al hacer scroll
 * hacia arriba. Con `prefers-reduced-motion` el `MotionConfig` del layout
 * neutraliza la animación y el bloque queda visible (AC9).
 */
export function SectionReveal({
  children,
  delay = 0,
  className,
}: SectionRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
