# E-commerce Tech

Proyecto de e-commerce de tecnología construido con Next.js 16, con módulos de
**cliente** (storefront) y **administración**. Todo el desarrollo se conduce con
Claude Code siguiendo una metodología SDD (Spec-Driven Development) y un
contrato de trabajo estricto documentado en [`CLAUDE.md`](./CLAUDE.md).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript estricto ·
Tailwind CSS 4 · shadcn/ui · Neon Postgres · Drizzle ORM · Clerk ·
TanStack Query v5 · TanStack Table v8 · Axios · Zustand · Recharts · Zod ·
React Hook Form · Stripe.

Testing: runner nativo de Node (`node --test`), sin librerías de terceros —
ver [`docs/SETUP.md`](./docs/SETUP.md) §7.

## Arranque local

```bash
npm install
npm run dev          # servidor de desarrollo (Turbopack)
npm run build        # build de producción
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # unit tests (node --test)
npm run db:generate  # generar migración Drizzle
npm run db:migrate   # aplicar migraciones a Neon
npm run db:seed      # datos de prueba
```

Copia `.env.example` a `.env.local` y completa las credenciales de Neon,
Clerk y Stripe antes de levantar el proyecto.

La arquitectura de carpetas, el flujo de datos y el modelo de datos completo
están documentados en [`docs/SETUP.md`](./docs/SETUP.md).

---

## Cómo se desarrolla este proyecto: SDD con IA

Este repositorio no se construye "a mano": cada feature pasa por un proceso
de **Spec-Driven Development** ejecutado con Claude Code, definido en
[`CLAUDE.md`](./CLAUDE.md) — el archivo se lee al inicio de cada sesión y
gobierna cómo se procesa cada petición sobre el código.

### El flujo

```
Prompt del usuario
        │
        ▼
  ┌──────────────┐
  │ orchestrator │  clasifica: ¿SDD o BUILD?
  └──────┬───────┘
         │
   ┌─────┴──────────────────────────────┐
   │                                    │
 MODO: SDD                          MODO: BUILD
   │                                    │
   ▼                                    ▼
 spec ──► ⏸ APROBACIÓN HUMANA ──► developer ⇄ reviewer ──► done
                                                 (bucle, máx. 3)
```

- **`orchestrator`** clasifica cada petición antes de que se escriba una
  sola línea de código: ¿es una feature de negocio nueva, un cambio de
  modelo de datos, una regla de dinero o permisos (→ **SDD**, con spec
  formal), o es un fix puntual, una pregunta o meta-trabajo del repo
  (→ **BUILD**, directo)?
- **`spec`** convierte el requerimiento en un documento corto y ejecutable
  en `docs/specs/NNN-slug.md`, con criterios de aceptación, modelo de datos,
  contratos de API y tareas atómicas — y **se detiene** ahí.
- **Puerta de aprobación humana**: ningún código se escribe sobre un spec en
  `status: draft`. Una persona tiene que responder `aprobado` (o pedir
  cambios) antes de que el spec pase a `status: approved` y se invoque a
  `developer`.
- **`developer` ⇄ `reviewer`** ejecutan y auditan la implementación en un
  bucle acotado a **3 iteraciones**. Si no converge en 3 vueltas, se detiene
  y se escala a una persona — el bucle no gira indefinidamente solo.
- Cada spec aprobado y ejecutado queda como documentación viva en
  `docs/specs/`, con el contexto, las decisiones técnicas y las tareas
  realmente hechas — no solo la intención original.

### Reglas duras: la IA no decide la arquitectura sobre la marcha

`CLAUDE.md` fija un conjunto de reglas de arquitectura que son **bloqueantes
en review**, no sugerencias. Entre las más importantes:

1. Un componente nunca importa `db`, Drizzle ni un repositorio directamente.
2. Un componente nunca llama a `axios`/`fetch` directo — pasa por
   `services/`, consumido vía hook.
3. Toda consulta a base de datos vive en `src/server/repositories/`.
4. Todo Route Handler valida su entrada con Zod antes de tocar datos.
5. Los tipos se **infieren** del schema de Drizzle; no se duplican a mano.
6. Datos de servidor → TanStack Query. Estado de UI → Zustand. Sin mezclar.
7. La autorización se verifica siempre por **código de permiso**
   (`requirePermission('products.create')`), nunca comparando nombres de rol
   en el código (`role === 'admin'`) — eso es un hallazgo bloqueante en
   review.
8. `audit_logs` es append-only y se escribe en la misma transacción que la
   mutación que audita, sin PII sensible ni secretos.

### Skills como fuente de conocimiento vigente

Antes de resolver una tarea con conocimiento de memoria, los agentes deben
revisar si existe una **skill** instalada que la cubra y usarla — las skills
traen la documentación vigente del stack (Next.js, shadcn, Clerk, Drizzle,
Stripe...), mientras que la memoria de un modelo se desactualiza. Si la
skill del mapa de `CLAUDE.md` §8 no está instalada, el agente sigue sin
inventarla y lo dice explícitamente.

### Verificación antes de dar por cerrada cualquier tarea

Ninguna tarea se considera terminada sin que, como mínimo, pase:

```bash
npm run typecheck && npm run lint && npm run build && npm run test
```

Esto aplica igual a lo que escribe un agente que a lo que escribe una
persona: el criterio de "hecho" no es "el código compila", es "el código
compila, pasa lint, buildea y tiene sus pruebas en verde".

### Documentación viva, no aspiracional

`docs/specs/` no es un archivo de intenciones: cada spec ejecutado refleja lo
que realmente se construyó, incluidas las tareas marcadas y los hallazgos de
review resueltos. Antes de proponer una feature nueva, se revisa primero si
ya existe un spec que la cubra — la fuente de verdad del "por qué" de una
decisión técnica es el spec correspondiente, no la memoria de quien pregunta.
