"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isOptimizableImageUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/modules/cart/store/cart.store";
import { formatPrice } from "@/modules/products/constants";
import { PRODUCT_IMAGE_FALLBACK } from "@/modules/storefront/constants";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

type ProductCardProps = {
  product: StorefrontProduct;
  /** Solo para las tarjetas visibles en el primer viewport. */
  priority?: boolean;
  className?: string;
};

export function ProductCard({
  product,
  priority = false,
  className,
}: ProductCardProps) {
  const addLine = useCartStore((state) => state.addLine);
  const href = `/products/${product.slug}`;

  const handleAdd = () =>
    addLine({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
    });

  return (
    <motion.article
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "group/product flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:shadow-none dark:ring-white/10",
        className,
      )}
    >
      {/* La imagen enlaza a la ficha, pero el nombre ya aporta el texto del
          enlace: repetirlo dejaría dos entradas al mismo destino en el lector
          de pantalla. */}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-4/3 overflow-hidden bg-muted/40 p-6"
      >
        <Image
          src={product.imageUrl ?? PRODUCT_IMAGE_FALLBACK}
          alt={product.name}
          fill
          priority={priority}
          unoptimized={!isOptimizableImageUrl(product.imageUrl)}
          sizes="(min-width: 1280px) 20rem, (min-width: 768px) 33vw, 80vw"
          className="object-contain drop-shadow-lg transition-transform duration-300 group-hover/product:scale-105"
        />

        <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
          {/* El badge solo existe si el mapper confirmó el descuento (§10). */}
          {product.discountPercent !== null && (
            <Badge className="bg-brand text-white">
              −{product.discountPercent}%
            </Badge>
          )}
          {product.isNew && <Badge variant="secondary">Nuevo</Badge>}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Badge variant="outline">Sin stock</Badge>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {product.brand ?? product.categoryName}
        </p>
        <h3 className="font-heading text-sm leading-snug font-medium text-balance">
          {/* El botón `+` queda fuera del enlace: dentro, un clic navegaría y
              añadiría al carrito a la vez (AC7). */}
          <Link href={href} className="transition-colors hover:text-brand">
            {product.name}
          </Link>
        </h3>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-heading text-xl font-semibold tabular-nums">
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtPriceCents !== null && (
              <span className="text-xs text-muted-foreground line-through tabular-nums">
                {formatPrice(product.compareAtPriceCents)}
              </span>
            )}
          </div>

          <Button
            type="button"
            size="icon-lg"
            className="rounded-full"
            disabled={!product.inStock}
            aria-label={`Añadir ${product.name} al carrito`}
            onClick={handleAdd}
          >
            <Plus />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
