# SETUP — E-commerce Tech

Documento único de referencia para el arranque del proyecto y la **arquitectura de
carpetas obligatoria**. Todo agente y toda tarea debe respetar esta estructura.

---

## 1. Stack

| Capa | Tecnología | Versión objetivo |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.x |
| Runtime UI | React | 19.x |
| Lenguaje | TypeScript (strict) | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Componentes | shadcn/ui (Radix + CVA) | latest |
| Base de datos | Neon Postgres (serverless) | — |
| ORM | Drizzle ORM + drizzle-kit | latest |
| Auth | Clerk (`@clerk/nextjs`) | latest |
| Estado servidor | TanStack Query v5 | 5.x |
| Tablas | TanStack Table v8 | 8.x |
| HTTP | Axios | 1.x |
| Estado cliente | Zustand | 5.x |
| Gráficos | Recharts | 2.x |
| Validación | Zod | 4.x |
| Formularios | React Hook Form + @hookform/resolvers | latest |
| Gestor de paquetes | **npm** | — |

---

## 2. Bootstrap del proyecto

```bash
# 1. Scaffold
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --turbopack --use-npm

# 2. Datos — Neon + Drizzle
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit dotenv tsx

# 3. Auth
npm i @clerk/nextjs

# 4. Estado de servidor y tablas
npm i @tanstack/react-query @tanstack/react-table
npm i -D @tanstack/react-query-devtools

# 5. HTTP, estado cliente, gráficos
npm i axios zustand recharts

# 6. Validación y formularios
npm i zod react-hook-form @hookform/resolvers

# 7. UI
npx shadcn@latest init
npx shadcn@latest add button input label card table dialog sheet \
  dropdown-menu select badge separator skeleton sonner form tabs avatar

# 8. Utilidades
npm i class-variance-authority clsx tailwind-merge lucide-react next-themes
npm i -D prettier prettier-plugin-tailwindcss
```

### Variables de entorno (`.env.local`)

```bash
# Neon
DATABASE_URL="postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`.env.local` va en `.gitignore`. Nunca se commitea. Mantén un `.env.example` con
las claves vacías.

### Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/server/db/seed.ts"
  }
}
```

---

## 3. Arquitectura de carpetas

Estructura **modular por dominio** sobre App Router. La regla base: el `app/`
solo enruta y compone; la lógica vive en `modules/` (cliente) y `server/` (datos).

```
.
├── .claude/
│   └── agents/                  orchestrator · spec · developer · reviewer
├── docs/
│   ├── SETUP.md                 este archivo
│   └── specs/                   NNN-slug.md — specs SDD (documentación viva)
├── drizzle/                     migraciones generadas por drizzle-kit
├── drizzle.config.ts
├── public/
└── src/
    ├── app/
    │   ├── (storefront)/        módulo CLIENTE
    │   │   ├── layout.tsx       header, footer, providers de tienda
    │   │   ├── page.tsx         home
    │   │   ├── products/
    │   │   │   ├── page.tsx     catálogo + filtros
    │   │   │   └── [slug]/page.tsx
    │   │   ├── cart/page.tsx
    │   │   ├── checkout/page.tsx
    │   │   └── orders/
    │   │       ├── page.tsx
    │   │       └── [id]/page.tsx
    │   ├── (admin)/             módulo ADMINISTRACIÓN
    │   │   └── admin/
    │   │       ├── layout.tsx   sidebar + guard de rol
    │   │       ├── page.tsx     dashboard (Recharts)
    │   │       ├── products/    CRUD (TanStack Table)
    │   │       ├── categories/
    │   │       ├── orders/
    │   │       ├── customers/
    │   │       ├── roles/       roles, permisos y asignaciones
    │   │       └── audit-logs/  bitácora (TanStack Table + filtros)
    │   ├── (auth)/
    │   │   ├── sign-in/[[...sign-in]]/page.tsx
    │   │   └── sign-up/[[...sign-up]]/page.tsx
    │   ├── api/                 Route Handlers — única API pública
    │   │   ├── products/route.ts
    │   │   ├── products/[id]/route.ts
    │   │   ├── categories/route.ts
    │   │   ├── cart/route.ts
    │   │   ├── orders/route.ts
    │   │   └── admin/
    │   │       ├── metrics/route.ts
    │   │       ├── roles/route.ts
    │   │       ├── permissions/route.ts
    │   │       └── audit-logs/route.ts
    │   ├── layout.tsx           root: fonts, ClerkProvider, Providers
    │   ├── globals.css
    │   └── not-found.tsx
    │
    ├── modules/                 FEATURES por dominio (lado cliente)
    │   └── <dominio>/           products | categories | cart | orders | customers | dashboard | roles | audit
    │       ├── components/      UI específica del dominio
    │       ├── hooks/           TanStack Query: useProducts, useCreateProduct
    │       ├── services/        llamadas axios tipadas (product.service.ts)
    │       ├── schemas/         Zod: entrada/salida del dominio
    │       ├── store/           Zustand, solo si el dominio tiene estado UI global
    │       ├── types/           tipos derivados del schema Drizzle
    │       └── constants.ts
    │
    ├── server/                  SOLO servidor — nunca importar desde cliente
    │   ├── db/
    │   │   ├── index.ts         cliente Drizzle + Neon
    │   │   ├── schema/          una tabla por archivo + index.ts barrel
    │   │   └── seed.ts
    │   ├── repositories/        acceso a datos (product.repository.ts)
    │   └── services/            reglas de negocio que cruzan repositorios
    │
    ├── components/
    │   ├── ui/                  shadcn — no editar a mano salvo tokens
    │   ├── shared/              header, footer, sidebar, data-table, empty-state
    │   └── providers/           query-provider, theme-provider
    │
    ├── lib/
    │   ├── axios.ts             instancia única con baseURL e interceptores
    │   ├── query-client.ts      config de TanStack Query
    │   ├── utils.ts             cn() y helpers puros
    │   ├── auth.ts              helpers de Clerk: requireAuth, requireAdmin
    │   ├── permissions.ts       PERMISSIONS (códigos), can(), requirePermission()
    │   ├── audit.ts             logAudit() — escribe en audit_logs dentro de la tx
    │   └── constants.ts
    │
    ├── hooks/                   hooks transversales (useDebounce, useMediaQuery)
    ├── testing/                 infraestructura de testing — nunca código de producto
    │   ├── register.mjs         entry de `--import`: activa el resolve hook
    │   ├── resolve-alias.mjs    resuelve `@/*` y los imports "estilo bundler" para Node
    │   ├── stubs/               reemplazos de paquetes que no cargan bajo Node a secas
    │   ├── mocks/                 mocks reusables de piezas externas: db, stripe, clerk
    │   └── helpers/                builders/fixtures de datos de prueba
    ├── types/                   tipos globales compartidos
    └── proxy.ts                 Clerk: rutas públicas vs protegidas vs admin (antes middleware.ts)
```

Los tests unitarios **no tienen carpeta propia por módulo**: se colocan junto al
archivo que prueban (ver convención de nombres abajo). `src/testing/` es la
única carpeta nueva y existe solo para lo que ningún archivo de producción
posee en particular — el loader que hace correr todo esto, y los mocks/fixtures
compartidos entre dominios. Se llama `testing/` y no `test/` a propósito:
`node --test` trata cualquier archivo dentro de una carpeta llamada `test` (o
`__tests__`) como una prueba a ejecutar, y correría el propio loader como si
fuera un test.

### Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivo de componente | kebab-case | `product-card.tsx` |
| Componente | PascalCase | `ProductCard` |
| Hook | `use` + camelCase | `useProducts` |
| Service | `<dominio>.service.ts` | `product.service.ts` |
| Repositorio | `<dominio>.repository.ts` | `product.repository.ts` |
| Schema Drizzle | singular | `src/server/db/schema/product.ts` |
| Tabla en Postgres | snake_case plural | `products`, `order_items` |
| Route Handler | `route.ts` | `app/api/products/route.ts` |
| Test unitario | `<archivo>.test.ts`, junto al original | `product.repository.test.ts` |
| Mock compartido | `<pieza>.mock.ts` en `src/testing/mocks/` | `db.mock.ts`, `stripe.mock.ts` |
| Fixture compartido | `<dominio>.fixture.ts` en `src/testing/helpers/` | `user.fixture.ts` |

---

## 4. Flujo de datos

```
Server Component ──────────────────────► repositorio ──► Drizzle ──► Neon
   (lectura inicial, SEO)

Client Component ──► hook (TanStack Query) ──► service (axios)
                                                     │
                                                     ▼
                                          Route Handler (/api)
                                             · Clerk auth
                                             · validación Zod
                                             · repositorio ──► Drizzle ──► Neon
```

**Reglas duras**

1. Un componente **nunca** importa `db`, Drizzle ni un repositorio.
2. Un componente **nunca** llama `axios`/`fetch` directo. Va en `services/`, se consume vía hook.
3. Toda consulta a BD vive en `src/server/repositories/`. Los Route Handlers orquestan, no consultan.
4. Todo Route Handler valida su entrada con Zod antes de llamar al repositorio.
5. Los tipos se **infieren** del schema Drizzle (`InferSelectModel`), no se escriben dos veces.
6. Datos de servidor → TanStack Query. Estado de UI (carrito local, filtros, sidebar) → Zustand. Sin mezclar.
7. `"use client"` lo más abajo posible en el árbol. Nunca en un layout que no lo necesita.

---

## 5. Modelo de datos inicial

El detalle exacto de cada tabla lo define su spec. Precios en **enteros
(centavos)**. Nunca `float`.

### 5.1 Identidad y acceso (RBAC)

| Tabla | Propósito | Relaciones |
|---|---|---|
| `users` | espejo local de Clerk: `clerk_id` (único), email, nombre, `is_active` | N—N `roles`, 1—N `orders`, 1—N `audit_logs` |
| `roles` | rol nombrado: `slug` (`customer`, `admin`, `manager`, `support`), nombre, descripción, `is_system` | N—N `users`, N—N `permissions` |
| `permissions` | permiso atómico: `code` único `<recurso>.<acción>` (`products.create`, `orders.update_status`), `resource`, `action`, descripción | N—N `roles` |
| `role_permissions` | pivote rol ↔ permiso. PK compuesta (`role_id`, `permission_id`) | N—1 `roles`, N—1 `permissions` |
| `user_roles` | pivote usuario ↔ rol. PK compuesta (`user_id`, `role_id`), `assigned_by`, `assigned_at` | N—1 `users`, N—1 `roles` |

**Cómo convive con Clerk**

- Clerk es la fuente de verdad de la **autenticación** (sesión, credenciales, MFA).
- Postgres es la fuente de verdad de la **autorización** (roles y permisos del dominio).
- `users` se sincroniza desde Clerk vía webhook (`user.created`, `user.updated`, `user.deleted`).
- El set de permisos efectivo se resuelve en servidor: `clerk_id → users → user_roles → role_permissions → permissions`.
- Cachear el set de permisos en `publicMetadata` de Clerk es opcional y **derivado**; ante discrepancia, gana Postgres.

**Reglas duras**

1. La verificación se hace siempre por `permission.code`, nunca por nombre de rol
   quemado en el código (`if (role === 'admin')` es un hallazgo bloqueante).
2. Los roles de sistema (`is_system = true`) no se borran ni se renombran desde la UI.
3. Un usuario sin filas en `user_roles` es `customer` por defecto. Ese default vive
   en un solo lugar del servidor, no repartido por la app.
4. `permissions` es una tabla semilla (`db:seed`), no editable desde el panel. Los
   permisos nacen del código; los roles se componen desde la UI.

### 5.2 Auditoría y logs

| Tabla | Propósito | Relaciones |
|---|---|---|
| `audit_logs` | traza inmutable de toda mutación relevante | N—1 `users` (`actor_id`, nullable) |

Columnas:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `actor_id` | fk `users.id` nullable | null = acción del sistema, cron o webhook |
| `action` | text | `product.created`, `order.status_changed`, `role.permission_granted`, `auth.login_failed` |
| `entity_type` | text | `product`, `order`, `user`, `role` |
| `entity_id` | text nullable | id del registro afectado |
| `changes` | jsonb nullable | `{ before, after }` — solo los campos que cambiaron |
| `metadata` | jsonb nullable | contexto extra (ruta, motivo, id de request) |
| `ip_address` | inet nullable | |
| `user_agent` | text nullable | |
| `severity` | enum | `info` \| `warning` \| `error` |
| `created_at` | timestamptz | default `now()` |

Índices: `(entity_type, entity_id)`, `(actor_id, created_at desc)`, `(action)`,
`(created_at desc)`.

**Reglas duras**

1. `audit_logs` es **append-only**. Sin `UPDATE`, sin `DELETE` desde la aplicación.
   El único borrado permitido es la purga por retención (job, no request de usuario).
2. Se escribe en la **misma transacción** que la mutación auditada. Si la mutación
   revierte, el log también.
3. Nunca se guarda PII sensible ni secretos en `changes` o `metadata`: sin
   contraseñas, tokens, claves de API ni datos de tarjeta. Los campos sensibles se
   enmascaran antes de serializar.
4. Un fallo al escribir el log **no** debe romper la operación de negocio salvo que
   la acción sea de seguridad (cambio de rol o permiso), donde sí es transaccional
   y bloqueante.
5. Retención sugerida: 180 días para `info`, indefinida para acciones de seguridad.

> `audit_logs` cubre también los eventos de autenticación y de seguridad mediante
> el prefijo de `action` (`auth.*`, `role.*`). Se separa en una tabla propia solo
> si el volumen o los patrones de consulta divergen de verdad.

### 5.3 Catálogo y ventas

| Tabla | Propósito | Relaciones |
|---|---|---|
| `categories` | taxonomía de productos | 1—N `products` |
| `products` | SKU, nombre, slug, precio, stock, specs | N—1 `categories` |
| `product_images` | galería | N—1 `products` |
| `carts` / `cart_items` | carrito persistido | N—1 `users`, `products` |
| `orders` | cabecera: total, estado, dirección | N—1 `users` |
| `order_items` | detalle con precio congelado | N—1 `orders`, `products` |

---

## 6. Módulos funcionales

### Cliente (storefront)
Catálogo con filtros y búsqueda · ficha de producto · carrito · checkout ·
historial y detalle de pedidos · perfil (Clerk).

### Administración
Dashboard con métricas (Recharts: ventas, pedidos, top productos, stock bajo) ·
CRUD de productos y categorías (TanStack Table: paginación, orden, filtros) ·
gestión de pedidos y cambio de estado · listado de clientes.

Gestión de accesos: CRUD de roles, matriz rol × permiso, asignación de roles a
usuarios · bitácora de auditoría filtrable por actor, entidad, acción y fecha.

Acceso admin protegido en dos capas: `proxy.ts` (borde) y verificación por
**código de permiso** en cada Route Handler bajo `/api/admin/`
(`requirePermission('products.create')`), nunca por nombre de rol.

---

## 7. Testing (unitario)

Runner: **nativo de Node** (`node --test` + `node:assert`), sin librerías de
terceros. Node 24 ejecuta `.ts` sin transpilar, así que un test se corre
directo sobre el archivo fuente. Comando (`package.json`):

```bash
npm test                                  # toda la suite
npm test -- src/lib/permissions.test.ts   # un archivo puntual
```

que equivale a:

```bash
node --env-file=.env.test --import ./src/testing/register.mjs --experimental-test-module-mocks --test
```

Los tres flags existen por razones concretas, no son boilerplate:

- **`--env-file=.env.test`**: varios módulos leen `process.env` al importarse
  (`server/db/index.ts` llama `neon(process.env.DATABASE_URL!)`; `lib/stripe.ts`
  lanza si falta `STRIPE_SECRET_KEY`). `.env.test` trae valores dummy — ningún
  test debe pegarle de verdad a Neon/Stripe/Clerk; lo que necesite esas piezas
  las mockea (§7.4), esto solo evita el throw al cargar el módulo.
- **`--import ./src/testing/register.mjs`**: activa un resolve hook
  (`src/testing/resolve-alias.mjs`) que resuelve lo que
  `moduleResolution: bundler` de `tsconfig.json` permite y Node en solitario
  no — el alias `@/*`, imports sin extensión y de carpeta (`./schema` →
  `./schema/index.ts`) — dejando que Node resuelva todo lo demás de forma
  nativa. También redirige `server-only` y `next/server` / `next/navigation`
  a réplicas mínimas en `src/testing/stubs/`: esos paquetes solo cargan
  dentro del bundler de Next (webpack tolera imports de JSON sin atributos y
  exports condicionados a `"react-server"`; el ESM estricto de Node, no).
- **`--experimental-test-module-mocks`**: habilita `mock.module()` de
  `node:test` (§7.4). Sigue marcado experimental en Node 24; es parte del
  propio runtime, no una dependencia de terceros.

### 7.1 Dónde viven los tests

Colocados junto al archivo que prueban, no en un árbol paralelo — un
`product.repository.ts` tiene su test como `product.repository.test.ts` en la
misma carpeta (sección 3, tabla de convenciones). Lo único que rompe esa regla
es lo que no pertenece a ningún archivo de producción concreto: la
infraestructura de testing (loader, stubs, mocks, fixtures) vive en
`src/testing/` — nunca `src/test/`, ver el porqué en la sección 3.

### 7.2 Qué se prueba primero

`docs/testing/funciones-testeables.md` es el inventario vivo de funciones
candidatas, agrupado por el mismo módulo/submódulo que esta arquitectura, con
una columna de dependencia (`Pura` / `DB` / `HTTP` / `Stripe` / `Clerk`) que
indica si el test necesita uno de los mocks de `src/testing/mocks/`. Se
prioriza lo marcado `Pura` (schemas Zod, formateadores, builders de SQL sin
ejecutar) antes que lo que requiere mock — y ojo: importar un archivo entero
puede arrastrar una dependencia "Pura" en apariencia hacia una que no lo es
(ej. cualquier archivo que importe, aunque sea indirectamente, `@/lib/auth`
carga la cadena de Clerk salvo que se mockee antes).

### 7.3 Mocks compartidos

`mock.module(especificador, { exports })` reemplaza un módulo **antes** de
importar el archivo bajo prueba — la llamada va primero, el `import()` (o
`require`) del archivo real, después:

```ts
import { mockClerkAuth } from "@/testing/mocks/clerk.mock.ts";
import { buildCurrentUser } from "@/testing/helpers/user.fixture.ts";

mockClerkAuth({ userId: null });
const { can } = await import("@/lib/permissions.ts");

assert.equal(can("products.view", buildCurrentUser({ isActive: false })), false);
```

`src/testing/mocks/` trae un helper por cada pieza externa que aparece en el
inventario: `db.mock.ts` (`@/server/db`), `stripe.mock.ts` (`@/lib/stripe`),
`clerk.mock.ts` (`@clerk/nextjs/server`). `src/testing/helpers/` trae
builders de datos de prueba (`user.fixture.ts`).

### 7.4 Descubrimiento

`node --test` reconoce por defecto cualquier `*.test.ts` colocado en el árbol
de `src/`, sin configuración adicional.

---

## 8. Checklist de arranque

- [x] `create-next-app` ejecutado con las flags de la sección 2
- [x] Dependencias instaladas
- [ ] Proyecto Neon creado y `DATABASE_URL` en `.env.local` (pendiente: requiere credenciales del usuario)
- [x] `drizzle.config.ts` apuntando a `src/server/db/schema`
- [ ] Aplicación Clerk creada y claves en `.env.local` (pendiente: requiere credenciales del usuario)
- [x] `proxy.ts` con rutas públicas, protegidas y de admin — Next.js 16 renombró `middleware.ts` a `proxy.ts`
- [ ] Webhook de Clerk (`user.created/updated/deleted`) sincronizando `users`
- [ ] Seed de `permissions` y roles de sistema ejecutado (`npm run db:seed`)
- [x] `ClerkProvider` + `QueryProvider` en `src/app/layout.tsx`
- [x] `shadcn init` ejecutado y componentes base agregados
- [x] Estructura de carpetas de la sección 3 creada
- [x] `npm run typecheck`, `npm run lint` y `npm run build` en verde
