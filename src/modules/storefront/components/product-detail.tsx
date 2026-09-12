import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { isOptimizableImageUrl } from "@/lib/image";
import { formatPrice } from "@/modules/products/constants";
import { AddToCartForm } from "@/modules/storefront/components/add-to-cart-form";
import { PRODUCT_IMAGE_FALLBACK } from "@/modules/storefront/constants";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

/**
 * Ficha completa. Server Component: solo el bloque de compra necesita estado,
 * y vive en `AddToCartForm` (§4.7, `"use client"` lo más abajo posible).
 */
export function ProductDetail({ product }: { product: StorefrontProduct }) {
  return (
    <article className="flex flex-col gap-8">
      <nav
        aria-label="Migas de pan"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link href="/products" className="transition-colors hover:text-foreground">
          Catálogo
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link
          href={`/products?category=${encodeURIComponent(product.categorySlug)}`}
          className="transition-colors hover:text-foreground"
        >
          {product.categoryName}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="relative aspect-4/3 overflow-hidden rounded-3xl bg-muted/40 p-8 ring-1 ring-foreground/5 dark:ring-white/10">
          <Image
            src={product.imageUrl ?? PRODUCT_IMAGE_FALLBACK}
            alt={product.name}
            fill
            priority
            unoptimized={!isOptimizableImageUrl(product.imageUrl)}
            sizes="(min-width: 1024px) 40rem, 92vw"
            className="object-contain drop-shadow-xl"
          />

          <div className="absolute top-4 left-4 flex flex-col items-start gap-1">
            {/* El badge solo existe si el mapper confirmó el descuento (§10). */}
            {product.discountPercent !== null && (
              <Badge className="bg-brand text-white">
                −{product.discountPercent}%
              </Badge>
            )}
            {product.isNew && <Badge variant="secondary">Nuevo</Badge>}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {product.brand ?? product.categoryName}
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              {product.name}
            </h1>
          </div>

          <div className="flex items-end gap-3">
            <span className="font-heading text-3xl font-semibold tabular-nums">
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtPriceCents !== null && (
              <span className="pb-1 text-sm text-muted-foreground line-through tabular-nums">
                {formatPrice(product.compareAtPriceCents)}
              </span>
            )}
          </div>

          <Badge variant={product.inStock ? "secondary" : "outline"}>
            {product.inStock ? "En stock" : "Sin stock"}
          </Badge>

          <Separator />

          <AddToCartForm key={product.id} product={product} />

          {product.description && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-base font-medium">
                  Descripción
                </h2>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {product.description}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
