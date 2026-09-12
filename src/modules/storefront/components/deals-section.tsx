"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, FreeMode } from "swiper/modules";
import { ArrowRight, Flame } from "lucide-react";

import { Button } from "@/components/ui/button";

// CSS local al único componente que monta Swiper (§8.8): no se cuela en el
// layout ni en ningún Server Component.
import "swiper/css";
import "swiper/css/free-mode";

import { DealsCountdown } from "@/modules/storefront/components/deals-countdown";
import { ProductCard } from "@/modules/storefront/components/product-card";
import type { StorefrontProduct } from "@/modules/storefront/schemas/catalog.schema";

export function DealsSection({ products }: { products: StorefrontProduct[] }) {
  return (
    <section id="ofertas" className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-medium text-brand">
            <Flame className="size-4" />
            Ofertas del día
          </span>
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Rebajas reales, no precios inflados
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <DealsCountdown />
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href="/products?onSale=true&sort=discount">
              Ver todas las ofertas
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ahora mismo no hay ofertas activas. Vuelve pronto.
        </p>
      ) : (
        <>
          <div className="hidden gap-4 md:grid md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="md:hidden">
            <Swiper
              modules={[A11y, FreeMode]}
              freeMode
              spaceBetween={12}
              slidesPerView={1.15}
              a11y={{ containerMessage: "Carrusel de ofertas" }}
            >
              {products.map((product) => (
                <SwiperSlide key={product.id} className="h-auto! pb-1">
                  <ProductCard product={product} className="h-full" />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </>
      )}
    </section>
  );
}
