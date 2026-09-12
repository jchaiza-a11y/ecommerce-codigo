"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import {
  ArrowUpRight,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { isOptimizableImageUrl } from "@/lib/image";
import { formatPrice } from "@/modules/products/constants";
import { PRODUCT_IMAGE_FALLBACK } from "@/modules/storefront/constants";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

type HeroBentoProps = {
  highlight: StorefrontProduct | null;
  categoryCount: number;
};

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

// §8.1(a): el mockup pedía una tarjeta de valoraciones, pero no hay tabla de
// reviews. En su lugar se muestran garantías de servicio, que sí son ciertas.
const TRUST_ITEMS = [
  { icon: Truck, label: "Envío en 24 h" },
  { icon: ShieldCheck, label: "2 años de garantía" },
  { icon: RotateCcw, label: "30 días para devolver" },
] as const;

export function HeroBento({ highlight, categoryCount }: HeroBentoProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid gap-6 md:grid-cols-3 md:grid-rows-2"
    >
      <motion.div
        variants={item}
        className="flex flex-col justify-center gap-6 rounded-3xl bg-linear-to-br from-brand/15 via-background to-brand-2/15 p-10 ring-1 ring-foreground/10 md:col-span-2 md:row-span-2 md:p-16"
      >
        <div className="flex items-center gap-3 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          <span className="h-px w-8 bg-foreground/30" aria-hidden />
          Nuevo catálogo de temporada
        </div>
        <h1 className="font-heading text-5xl leading-[1.05] font-semibold tracking-tight text-balance md:text-7xl">
          Tecnología que{" "}
          <span className="bg-linear-to-r from-brand to-brand-2 bg-clip-text text-transparent">
            rinde de verdad
          </span>
        </h1>
        <p className="max-w-lg text-base text-muted-foreground text-pretty">
          Portátiles, componentes, audio y periféricos elegidos uno a uno. Sin
          letra pequeña: el precio que ves es el que pagas.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild size="lg" className="rounded-full py-1 pr-1 pl-6">
            <Link
              href="/products?onSale=true&sort=discount"
              className="inline-flex items-center gap-3"
            >
              Ver ofertas
              <span className="flex size-8 items-center justify-center rounded-full bg-background/25">
                <ArrowUpRight className="size-4" />
              </span>
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-6">
            <Link href="/products">
              Explorar {categoryCount > 0 ? categoryCount : ""} categorías
            </Link>
          </Button>
        </div>
      </motion.div>

      <motion.div
        variants={item}
        className="flex flex-col gap-5 rounded-3xl bg-card p-8 ring-1 ring-foreground/10"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <PackageCheck className="size-4 text-brand" />
          Compra sin sorpresas
        </div>
        <ul className="flex flex-col gap-4">
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Icon className="size-4" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        variants={item}
        className="relative flex min-h-56 flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/10"
      >
        {highlight ? (
          <>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Destacado
            </p>
            <div className="relative -mx-2 flex-1">
              <Image
                src={highlight.imageUrl ?? PRODUCT_IMAGE_FALLBACK}
                alt={highlight.name}
                fill
                priority
                unoptimized={!isOptimizableImageUrl(highlight.imageUrl)}
                sizes="(min-width: 768px) 22rem, 100vw"
                className="object-contain drop-shadow-xl"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-heading text-sm font-medium">{highlight.name}</p>
              <p className="font-heading text-xl font-semibold tabular-nums">
                {formatPrice(highlight.priceCents)}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-5 text-center text-sm text-muted-foreground">
            Aún no hay productos destacados.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
