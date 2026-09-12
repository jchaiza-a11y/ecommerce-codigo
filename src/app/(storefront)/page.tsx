import { cache, Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChips } from "@/modules/storefront/components/category-chips";
import { DealsSection } from "@/modules/storefront/components/deals-section";
import { FeaturedGrid } from "@/modules/storefront/components/featured-grid";
import { HeroBento } from "@/modules/storefront/components/hero-bento";
import { NewsletterForm } from "@/modules/storefront/components/newsletter-form";
import { ProductGridSkeleton } from "@/modules/storefront/components/product-grid-skeleton";
import { SectionReveal } from "@/modules/storefront/components/section-reveal";
import { DEALS_LIMIT, FEATURED_LIMIT } from "@/modules/storefront/constants";
import { toStorefrontCategory } from "@/modules/storefront/lib/to-storefront-category";
import { toStorefrontProduct } from "@/modules/storefront/lib/to-storefront-product";
import type {
  StorefrontCategory,
  StorefrontProduct,
} from "@/modules/storefront/schemas/catalog.schema";

/**
 * La landing lee del repositorio, no de `fetch`, así que sin esto Next la
 * prerenderiza una vez en el build y nunca vuelve a mirar la base de datos: un
 * alta de producto en el admin no aparecería jamás, y un build sin
 * `DATABASE_URL` dejaría el estado de error congelado (AC11).
 */
export const revalidate = 60;

type SectionResult<T> = { status: "ok"; data: T } | { status: "error" };

/**
 * El cliente Drizzle lee `DATABASE_URL` al evaluarse el módulo, así que un
 * entorno sin configurar reventaría en el `import` y no en la consulta. El
 * import diferido lo mete dentro del `try` y deja que cada sección caiga a su
 * propio estado de error en vez de tumbar `/` (AC11).
 */
async function loadSection<T>(
  label: string,
  load: () => Promise<T>,
): Promise<SectionResult<T>> {
  try {
    return { status: "ok", data: await load() };
  } catch (error) {
    console.error(`Landing: no se pudo cargar ${label}`, error);

    return { status: "error" };
  }
}

const loadFeatured = cache(
  (): Promise<SectionResult<StorefrontProduct[]>> =>
    loadSection("los destacados", async () => {
      const productRepository = await import(
        "@/server/repositories/product.repository"
      );
      const rows = await productRepository.findPublic({
        sort: "newest",
        perPage: FEATURED_LIMIT,
      });

      return rows.map(toStorefrontProduct);
    }),
);

const loadDeals = cache(
  (): Promise<SectionResult<StorefrontProduct[]>> =>
    loadSection("las ofertas", async () => {
      const productRepository = await import(
        "@/server/repositories/product.repository"
      );
      const rows = await productRepository.findPublic({
        onSale: true,
        sort: "discount",
        perPage: DEALS_LIMIT,
      });

      return rows.map(toStorefrontProduct);
    }),
);

const loadCategories = cache(
  (): Promise<SectionResult<StorefrontCategory[]>> =>
    loadSection("las categorías", async () => {
      const categoryRepository = await import(
        "@/server/repositories/category.repository"
      );
      const rows = await categoryRepository.findActiveWithProductCount();

      return rows.map(toStorefrontCategory);
    }),
);

function SectionError({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-destructive/40 p-8 text-center text-sm text-destructive">
      {children}
    </p>
  );
}

async function HeroSection() {
  const [featured, categories] = await Promise.all([
    loadFeatured(),
    loadCategories(),
  ]);

  return (
    <HeroBento
      highlight={featured.status === "ok" ? (featured.data[0] ?? null) : null}
      categoryCount={categories.status === "ok" ? categories.data.length : 0}
    />
  );
}

function HeroSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
      <Skeleton className="min-h-72 rounded-3xl md:col-span-2 md:row-span-2" />
      <Skeleton className="min-h-40 rounded-3xl" />
      <Skeleton className="min-h-40 rounded-3xl" />
    </div>
  );
}

async function DealsBlock() {
  const deals = await loadDeals();

  if (deals.status === "error") {
    return (
      <SectionError>
        No pudimos cargar las ofertas. Actualiza la página en un momento.
      </SectionError>
    );
  }

  return <DealsSection products={deals.data} />;
}

async function CategoriesBlock() {
  const categories = await loadCategories();

  if (categories.status === "error") {
    return (
      <SectionError>
        No pudimos cargar las categorías. Actualiza la página en un momento.
      </SectionError>
    );
  }

  return <CategoryChips categories={categories.data} />;
}

async function FeaturedBlock() {
  const featured = await loadFeatured();

  if (featured.status === "error") {
    return (
      <SectionError>
        No pudimos cargar el catálogo. Actualiza la página en un momento.
      </SectionError>
    );
  }

  return <FeaturedGrid products={featured.data} />;
}

export default function StorefrontHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6 md:gap-24 md:py-12">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-72" />
            <ProductGridSkeleton count={4} />
          </div>
        }
      >
        <SectionReveal>
          <DealsBlock />
        </SectionReveal>
      </Suspense>

      <section id="categorias" className="flex flex-col gap-6 scroll-mt-24">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Compra por categoría
          </h2>
          <p className="text-sm text-muted-foreground">
            Todo el catálogo ordenado por lo que vienes buscando.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-24 w-full rounded-2xl" />}>
          <SectionReveal>
            <CategoriesBlock />
          </SectionReveal>
        </Suspense>
      </section>

      <section id="destacados" className="flex flex-col gap-6 scroll-mt-24">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Novedades del catálogo
          </h2>
          <p className="text-sm text-muted-foreground">
            Lo último que ha entrado en almacén.
          </p>
        </div>
        <Suspense fallback={<ProductGridSkeleton count={FEATURED_LIMIT} />}>
          <SectionReveal>
            <FeaturedBlock />
          </SectionReveal>
        </Suspense>
      </section>

      <SectionReveal>
        <NewsletterForm />
      </SectionReveal>
    </div>
  );
}
