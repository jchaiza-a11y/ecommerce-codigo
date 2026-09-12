import "server-only";

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY no está configurada");
}

/**
 * Única pieza del proyecto que importa el SDK de Stripe (docs/stripe/README.md
 * §5). `server-only` corta de raíz que un componente lo arrastre al bundle.
 *
 * La `apiVersion` se fija a la que pinea el SDK instalado (22.x): su tipo
 * `LatestApiVersion` es el literal de esa versión y no admite otro. El spec
 * mencionaba `2026-07-29.dahlia`, anterior al pin del paquete publicado.
 */
export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-08-26.dahlia",
});
