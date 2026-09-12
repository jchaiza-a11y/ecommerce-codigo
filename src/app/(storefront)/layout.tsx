import { MotionProvider } from "@/components/providers/motion-provider";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { CartDrawer } from "@/modules/cart/components/cart-drawer";

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <MotionProvider>
      <div className="flex min-h-full flex-1 flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {/* Montado una sola vez: es el punto de rehidratación del carrito y el
            destino de `setOpen(true)` desde cualquier tarjeta. */}
        <CartDrawer />
      </div>
    </MotionProvider>
  );
}
