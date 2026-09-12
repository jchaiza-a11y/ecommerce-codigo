import Link from "next/link";
import { Zap } from "lucide-react";

import { Separator } from "@/components/ui/separator";

const FOOTER_SECTIONS = [
  {
    title: "Tienda",
    links: [
      { href: "#ofertas", label: "Ofertas" },
      { href: "#categorias", label: "Categorías" },
      { href: "#destacados", label: "Destacados" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "#envios", label: "Envíos y plazos" },
      { href: "#devoluciones", label: "Devoluciones" },
      { href: "#garantia", label: "Garantía" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/sign-in", label: "Iniciar sesión" },
      { href: "/sign-up", label: "Crear cuenta" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[2fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
                <Zap className="size-4" />
              </span>
              <span className="font-heading text-lg font-semibold tracking-tight">
                Nexo Tech
              </span>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tecnología seleccionada, precios claros y soporte que responde.
              Envío en 24 h a península y dos años de garantía en todo el
              catálogo.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <p className="font-heading text-sm font-medium">{section.title}</p>
              <ul className="flex flex-col gap-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Nexo Tech. Todos los derechos reservados.</p>
          <p>Precios con IVA incluido.</p>
        </div>
      </div>
    </footer>
  );
}
