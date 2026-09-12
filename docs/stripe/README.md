# Integración con Stripe — Checkout (nivel educativo)

> Documento de referencia, no un spec SDD. Se generó fuera del flujo
> `orchestrator → spec → developer → reviewer` a pedido explícito del usuario.
> Cuando se implemente de verdad, cada tarea (schema de `orders`, route handlers,
> webhook) sí debe pasar por su spec en `docs/specs/`, como marca `CLAUDE.md`.

Objetivo: aceptar pagos con **Stripe Checkout** (página alojada por Stripe) para
compras únicas (`mode: "payment"`), reutilizando `products` como fuente de verdad
de precio y stock. Sin suscripciones, sin Connect, sin sincronizar catálogo.

---

## 1. Decisión: ¿sincronizar el catálogo de `products` con Stripe?

**No, para este alcance.** Stripe Checkout admite dos formas de fijar el precio
de cada línea:

| Modo | Cómo funciona | Cuándo conviene |
|---|---|---|
| `line_items[].price` | Referencia a un `Product`/`Price` **pre-creado** en Stripe | Catálogo fijo que vive en Stripe, suscripciones, Payment Links, Stripe Tax con `tax_code` por producto |
| `line_items[].price_data` | Precio y nombre **inline**, calculados por tu servidor en cada request | Catálogo administrado en tu propia BD, precios/stock que cambian seguido |

Con `price_data` la Checkout Session se arma en el momento con los datos que ya
tenemos en `products` (`priceCents`, `name`). No hace falta crear ni mantener un
`Product`/`Price` espejo en Stripe, ni resolver qué pasa cuando alguien edita un
precio en el admin y el espejo queda desactualizado.

**Razones concretas para no sincronizar todavía:**

1. **Una sola fuente de verdad.** Postgres ya es la fuente de verdad de precio y
   stock (regla dura de `docs/SETUP.md` §4.5: precios en centavos, sin duplicar
   tipos). Sincronizar crea una segunda copia que se puede desalinear si falla un
   webhook o un job.
2. **Seguridad.** El precio de cada línea se recalcula en el servidor a partir del
   `product.id` que manda el cliente — nunca se confía en un precio que venga del
   navegador. Con `price_data` eso es directo: se lee `priceCents` de la fila
   actual y se arma el `price_data` con ese valor.
3. **No hay caso de uso todavía que lo exija.** Sincronizar catálogo (crear
   `Product`/`Price` en Stripe) solo aporta valor cuando aparece alguno de estos
   escenarios, ninguno vigente en el alcance actual:
   - Suscripciones o facturación recurrente (Stripe Billing necesita un `Price`
     persistente).
   - Payment Links (no-code) para vender sin pasar por tu backend.
   - Stripe Tax calculando por `tax_code` de producto en vez de por sesión.
   - Reporting/analítica del lado de Stripe a nivel de producto.

**Revisar esta decisión cuando** el proyecto agregue suscripciones, planes,
Payment Links, o Stripe Tax por producto. En ese momento sí conviene un job de
sincronización (`stripeProductId` / `stripePriceId` en la tabla `products`) — no
antes.

---

## 2. Prerrequisitos

- [ ] Cuenta de Stripe (modo test) o sandbox generado con la CLI.
- [x] Plugin `stripe` de Claude Code ya instalado (`/plugin` → `stripe`).
- [ ] Stripe CLI instalada para probar webhooks en local:
  ```bash
  npm i -g @stripe/cli
  stripe login
  # o, sin cuenta todavía:
  stripe sandbox create
  ```
- [ ] Claves de API en modo test. Preferir una **restricted key** (`rk_test_...`)
  con permisos mínimos (Checkout Sessions: write, Webhook Endpoints: write) en
  vez del secret key completo (`sk_test_...`).

---

## 3. Dependencias

```bash
npm i stripe
```

SDK de Node recomendado: `stripe@22.x` (misma major que la API version vigente,
`2026-07-29.dahlia` al momento de escribir esto — revisar la última en
[docs.stripe.com/changelog](https://docs.stripe.com/changelog.md)).

No se instala `@stripe/stripe-js` ni Elements: Checkout hospedado redirige a
`session.url`, no necesita JS de Stripe en el cliente.

---

## 4. Variables de entorno

Agregar a `.env.example` y `.env.local` (nunca commitear `.env.local`):

```bash
# Stripe
STRIPE_SECRET_KEY="rk_test_..."          # restricted key, no sk_ completa
STRIPE_WEBHOOK_SECRET="whsec_..."        # la da `stripe listen` en local, o el endpoint en producción
```

`NEXT_PUBLIC_APP_URL` ya existe (`docs/SETUP.md` §2) y se reutiliza para armar
`success_url` / `cancel_url`.

Guardar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en el gestor de secretos
del hosting (en Vercel, como *sensitive environment variable*), nunca en código
ni en logs.

---

## 5. Dónde vive cada pieza (según `docs/SETUP.md`)

```
src/
├── lib/
│   └── stripe.ts                    cliente Stripe único (server-only)
├── modules/
│   └── checkout/
│       ├── components/              botón "Pagar con Stripe", páginas de resultado
│       ├── hooks/                   useCreateCheckoutSession (TanStack Query)
│       ├── services/                checkout.service.ts (axios)
│       └── schemas/                 Zod: body de /api/checkout/session
├── app/
│   ├── (storefront)/
│   │   └── checkout/
│   │       ├── page.tsx             resumen del carrito + botón de pago
│   │       ├── success/page.tsx     lectura de estado, NO fulfillment
│   │       └── cancel/page.tsx
│   └── api/
│       ├── checkout/
│       │   └── session/route.ts     crea la Checkout Session
│       └── webhooks/
│           └── stripe/route.ts      recibe eventos de Stripe
└── server/
    ├── db/schema/
    │   ├── order.ts                 nuevo
    │   └── order-item.ts            nuevo
    ├── repositories/
    │   └── order.repository.ts      nuevo
    └── services/
        └── checkout.service.ts      arma line_items, valida stock, orquesta el pedido
```

`src/lib/stripe.ts` es la única pieza que importa el SDK de `stripe`. Nada en
`modules/*/components` ni en el cliente lo toca directamente (regla dura #2 de
`CLAUDE.md`: un componente nunca llama a un SDK de servidor).

```ts
// src/lib/stripe.ts
import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY no está configurada");
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-07-29.dahlia",
});
```

---

## 6. Modelo de datos nuevo

`docs/SETUP.md` §5.3 ya reserva `orders` / `order_items`; hoy no existen en
`src/server/db/schema/`. Se crean como parte de esta integración, con precio
**congelado** en cada línea (nunca se relee `products.priceCents` para pedidos
viejos) y los identificadores de Stripe necesarios para conciliar el webhook.

```ts
// src/server/db/schema/order.ts
export const orderStatus = pgEnum("order_status", [
  "pending",   // Checkout Session creada, esperando pago
  "paid",      // checkout.session.completed / async_payment_succeeded
  "failed",    // async_payment_failed o session expirada
  "canceled",
]);

export const order = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id),
  status: orderStatus("status").notNull().default("pending"),
  totalCents: integer("total_cents").notNull(),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 })
    .notNull()
    .unique(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

```ts
// src/server/db/schema/order-item.ts
export const orderItem = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => order.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => product.id, { onDelete: "restrict" }),
  // Snapshot: si el producto cambia de precio o se borra, el pedido histórico no.
  productName: varchar("product_name", { length: 140 }).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
});
```

Esto es diseño de referencia para cuando se arme el spec de `orders`/checkout
(sección 1 de `CLAUDE.md`) — no se implementa por fuera de ese flujo.

---

## 7. Flujo end-to-end

```
Cliente (carrito)
   │  POST /api/checkout/session  { items: [{ productId, quantity }] }
   ▼
Route Handler /api/checkout/session
   │  1. Zod valida el body (regla dura #4)
   │  2. requireAuth() — Checkout siempre atado a un usuario logueado
   │  3. checkout.service.ts: por cada item, lee `product` en BD
   │     (precio, stock, isActive) — el precio del cliente se ignora
   │  4. Si algún producto no tiene stock suficiente → 409, no se crea sesión
   │  5. order.repository.ts: crea `orders` en status "pending" + `order_items`
   │  6. stripe.checkout.sessions.create({ mode: "payment", line_items, ... })
   │  7. Responde { url: session.url }
   ▼
Cliente → redirect a session.url (página alojada por Stripe)
   │
   ▼
Stripe procesa el pago
   │
   ├──► success_url ──► /checkout/success (solo UI, NO marca el pedido pagado)
   │
   └──► Webhook checkout.session.completed / async_payment_succeeded
            │
            ▼
        /api/webhooks/stripe
          1. Verifica firma con STRIPE_WEBHOOK_SECRET
          2. Si payment_status !== "unpaid": marca `orders.status = "paid"`,
             descuenta stock, escribe `audit_logs` en la misma transacción
             (regla dura #9 de CLAUDE.md)
          3. checkout.session.async_payment_failed → status "failed"
```

**Por qué el fulfillment va en el webhook y no en `/checkout/success`:** un
cliente puede pagar y perder la conexión antes de volver a tu página. Si el
pedido solo se marca "pagado" cuando alguien visita `/success`, esos pagos
quedan huérfanos. El webhook es la única fuente confiable.

---

## 8. Implementación paso a paso

### 8.1 Servicio de checkout (server, `src/server/services/checkout.service.ts`)

- Recibe `{ productId, quantity }[]`.
- Por cada línea: `product.repository.findById` (o `findPublicBySlug` si el
  carrito viaja por slug), valida `isActive`, `stock >= quantity`.
- Arma `line_items` con `price_data`, **nunca** `payment_method_types` (dejar que
  Stripe decida los métodos de pago disponibles — ver skill
  `stripe:stripe-best-practices`):

  ```ts
  const lineItems = items.map(({ product, quantity }) => ({
    price_data: {
      currency: "usd", // o la moneda del negocio
      product_data: { name: product.name },
      unit_amount: product.priceCents,
    },
    quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`,
    client_reference_id: order.id, // conecta la sesión con tu `orders.id`
    customer_email: user.email,
  });
  ```

- Guarda `order.stripeCheckoutSessionId = session.id` antes de responder al
  cliente.

### 8.2 Route Handler (`src/app/api/checkout/session/route.ts`)

- `requireAuth()` (`src/lib/auth.ts`) — sin sesión, 401.
- Valida el body con un schema Zod en `modules/checkout/schemas/`.
- Delega todo a `checkout.service.ts`. El handler solo orquesta (regla dura #3).

### 8.3 Webhook (`src/app/api/webhooks/stripe/route.ts`)

Punto delicado: Stripe firma el **cuerpo crudo** de la request. En un Route
Handler de App Router se lee con `req.text()`, nunca con `req.json()` (eso ya
parsea y rompe la firma).

```ts
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new Response("Firma inválida", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "unpaid") {
        await fulfillCheckout(session); // marca "paid", descuenta stock, audit log
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markOrderFailed(session);
      break;
    }
  }

  return new Response(null, { status: 200 });
}
```

`fulfillCheckout` debe ser **idempotente**: Stripe reintenta el webhook si no
responde 2xx a tiempo, así que dos entregas del mismo evento no deben descontar
stock dos veces (chequear `orders.status` antes de aplicar el cambio).

`/api/webhooks(.*)` ya está en la lista de rutas públicas de `src/proxy.ts` —no
hace falta tocar el proxy, el webhook se autentica con la firma de Stripe, no
con Clerk.

### 8.4 Páginas de resultado

- `/checkout/success`: lee el `session_id` de la URL solo para mostrar un
  resumen (`stripe.checkout.sessions.retrieve`), **no** para marcar el pedido
  como pagado.
- `/checkout/cancel`: vuelve al carrito, la Checkout Session queda `expired`
  sola a las 24 h.

---

## 9. Probar en local

```bash
# Terminal 1
npm run dev

# Terminal 2 — reenvía eventos de Stripe a tu servidor local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copia el "whsec_..." que imprime a STRIPE_WEBHOOK_SECRET en .env.local

# Terminal 3 — dispara un pago de prueba
stripe trigger checkout.session.completed
```

Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y CVC (ver
skill `stripe:test-cards` para más escenarios: fallo, 3DS, etc.).

---

## 10. Seguridad

- **Restricted key**, no secret key completo (`docs/SETUP.md` no lo menciona
  porque es nuevo para este proyecto — aplica la misma disciplina que con
  `CLERK_SECRET_KEY`).
- Nunca loguear `STRIPE_SECRET_KEY` ni `STRIPE_WEBHOOK_SECRET`.
- Verificar siempre la firma del webhook antes de tocar la base de datos.
- No pasar `payment_method_types` en ningún request — se deja que Stripe
  determine dinámicamente los métodos de pago habilitados desde el Dashboard.
- CSP: agregar `https://*.stripe.com` a `script-src`/`frame-src`/`connect-src`
  si más adelante se suma Stripe.js/Elements (con Checkout alojado puro no es
  estrictamente necesario, pero conviene dejarlo listo).

---

## 11. Checklist antes de pasar a modo live

- [ ] Claves de test reemplazadas por claves live (`rk_live_...`) vía variables
      de entorno del hosting, no en código.
- [ ] Webhook endpoint registrado en el Dashboard de Stripe (no solo `stripe listen`)
      apuntando a `https://<dominio>/api/webhooks/stripe`.
- [ ] `fulfillCheckout` probado con reintentos (idempotencia).
- [ ] Manejo de `checkout.session.async_payment_failed` implementado (no solo el
      caso feliz).
- [ ] Revisar [Go Live Checklist](https://docs.stripe.com/get-started/checklist/go-live.md)
      de Stripe.

---

## 12. Fuera de alcance (para más adelante)

- Sincronizar `products` con `Product`/`Price` de Stripe — solo si aparece
  necesidad real (ver sección 1).
- Suscripciones / Stripe Billing.
- Stripe Tax automático (`automatic_tax`) — requiere una registración fiscal
  activa antes de activarlo, si no Stripe no cobra impuesto igual mostrando que
  sí lo hace.
- Stripe Connect / marketplace multi-vendedor.
