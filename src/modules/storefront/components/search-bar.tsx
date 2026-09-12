"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isOptimizableImageUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/modules/cart/store/cart.store";
import { formatPrice } from "@/modules/products/constants";
import {
  PRODUCT_IMAGE_FALLBACK,
  SEARCH_MIN_LENGTH,
} from "@/modules/storefront/constants";
import { useProductSearch } from "@/modules/storefront/hooks/use-product-search";
import { useStorefrontCategories } from "@/modules/storefront/hooks/use-storefront-categories";

export function SearchBar({ className }: { className?: string }) {
  const [term, setTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const router = useRouter();

  const productsQuery = useProductSearch(term);
  const categoriesQuery = useStorefrontCategories();
  const addLine = useCartStore((state) => state.addLine);

  const normalized = term.trim().toLowerCase();
  const isSearching = normalized.length >= SEARCH_MIN_LENGTH;

  // La taxonomía es una lista corta ya cacheada: filtrarla en cliente evita un
  // endpoint de búsqueda de categorías solo para el dropdown.
  const matchingCategories = isSearching
    ? (categoriesQuery.data ?? []).filter((category) =>
        category.name.toLowerCase().includes(normalized),
      )
    : [];

  const products = productsQuery.data?.items ?? [];

  function goToResults() {
    router.push(`/products?q=${encodeURIComponent(term.trim())}`);
    setIsOpen(false);
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={term}
        role="combobox"
        aria-expanded={isOpen && isSearching}
        aria-controls={listboxId}
        placeholder="Busca portátiles, auriculares, teclados…"
        className="h-10 rounded-full pr-11 pl-9"
        onChange={(event) => {
          setTerm(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
          if (event.key === "Enter" && isSearching) {
            goToResults();
          }
        }}
      />
      <Button
        type="button"
        size="icon-sm"
        className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full"
        disabled={!isSearching}
        aria-label="Ver todos los resultados"
        onClick={goToResults}
      >
        <ArrowRight />
      </Button>

      {isOpen && isSearching && (
        <div
          id={listboxId}
          className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl bg-popover shadow-lg ring-1 ring-foreground/10"
        >
          {productsQuery.isPending || productsQuery.isFetching ? (
            <ul className="flex flex-col gap-2 p-3">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </li>
              ))}
            </ul>
          ) : productsQuery.isError ? (
            <p className="p-4 text-sm text-destructive">
              No se pudo completar la búsqueda. Inténtalo de nuevo.
            </p>
          ) : products.length === 0 && matchingCategories.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Sin resultados para “{term.trim()}”.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {matchingCategories.length > 0 && (
                <div className="border-b p-3">
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Categorías
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchingCategories.map((category) => (
                      <Badge key={category.id} variant="secondary">
                        {category.name} · {category.productCount}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {products.length > 0 && (
                <ul className="flex flex-col p-1.5">
                  {products.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-muted"
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={product.imageUrl ?? PRODUCT_IMAGE_FALLBACK}
                          alt={product.name}
                          fill
                          unoptimized={!isOptimizableImageUrl(product.imageUrl)}
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.categoryName} ·{" "}
                          {formatPrice(product.priceCents)}
                        </p>
                      </div>
                      {/* La ficha de producto llega en su propia fase (§3): de
                          momento el resultado se puede añadir al carrito. */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-foreground"
                        disabled={!product.inStock}
                        aria-label={`Añadir ${product.name} al carrito`}
                        onClick={() =>
                          addLine({
                            productId: product.id,
                            name: product.name,
                            slug: product.slug,
                            priceCents: product.priceCents,
                            imageUrl: product.imageUrl,
                          })
                        }
                      >
                        <Plus />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* AC8: el dropdown es un adelanto; el catálogo filtrado por el mismo
              término vive en `/products`. */}
          {!productsQuery.isPending &&
            !productsQuery.isFetching &&
            !productsQuery.isError && (
              <Link
                href={`/products?q=${encodeURIComponent(term.trim())}`}
                className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm font-medium hover:bg-muted"
                onClick={() => setIsOpen(false)}
              >
                Ver todos los resultados
                <ArrowRight className="size-4" />
              </Link>
            )}
        </div>
      )}
    </div>
  );
}
