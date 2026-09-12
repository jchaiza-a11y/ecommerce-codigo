import Link from "next/link";
import { Zap } from "lucide-react";

import { AuthMenu } from "@/components/shared/auth-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { CartButton } from "@/modules/cart/components/cart-button";
import { SearchBar } from "@/modules/storefront/components/search-bar";

const NAV_LINKS = [
  { href: "#ofertas", label: "Ofertas" },
  { href: "#categorias", label: "Categorías" },
  { href: "#destacados", label: "Destacados" },
] as const;

/**
 * Server Component: solo los tres islotes interactivos (buscador, tema,
 * carrito) cruzan la frontera de cliente.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-3 z-40 px-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 rounded-2xl border bg-background/80 px-4 py-3 shadow-sm backdrop-blur-md md:rounded-full">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand text-white">
            <Zap className="size-4" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">
            Nexo Tech
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Secciones">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <SearchBar className="order-last w-full min-w-0 basis-full md:order-none md:mx-auto md:max-w-md md:basis-auto" />

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <CartButton />
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
