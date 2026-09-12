---
id: 3
title: Roles y permisos (RBAC) sobre Clerk — Fase 3
status: done
module: auth
scope: both
created: 2026-08-31
---

# 003 — Roles y permisos (RBAC) sobre Clerk — Fase 3

## 1. Contexto

Hay login funcional con Clerk (email/password + Google) y **cero autorización**:
`src/proxy.ts` solo distingue autenticado / no autenticado, y `/admin/products` y
`/admin/categories` están **temporalmente públicas** por decisión documentada en
`002-products.md` §11 (`isTemporarilyPublicAdminRoute`, `proxy.ts:14-20`, con los
TODO(001)/TODO(002) que dicen textualmente "revertir en el spec de auth/RBAC").

No existe tabla `users` en Postgres, ni `roles`, ni `permissions`, ni `audit_logs`,
aunque `docs/SETUP.md` §5.1/§5.2 ya documenta el modelo objetivo. `src/lib/` solo
tiene `axios.ts`, `query-client.ts` y `utils.ts`; `src/types/` está vacío;
`src/server/db/seed.ts` no existe pese a que `db:seed` sí está en `package.json`;
`src/server/services/` está vacío. Las carpetas `(admin)/admin/roles/` y
`(admin)/admin/audit-logs/` existen vacías (creadas por el scaffold).

Este spec cierra la brecha: modela roles/permisos en Postgres (fuente de verdad de
autorización), sincroniza usuarios desde Clerk, protege por **código de permiso**
(regla dura CLAUDE.md §4.8) y da a `super_admin`/`admin` una pantalla amigable
para crear usuarios y asignarles roles.

## 2. Objetivo

Un `super_admin` o `admin` puede crear usuarios y asignarles roles desde
`/admin/users`, y cada ruta y endpoint de administración queda accesible solo a
quien tenga el permiso correspondiente, con toda mutación de acceso registrada en
`audit_logs`.

## 3. Alcance

**Incluye:** 6 tablas Drizzle (`users`, `roles`, `permissions`, `role_permissions`,
`user_roles`, `audit_logs`) + migración + `seed.ts` idempotente · 5 repositorios ·
webhook `user.created/updated/deleted` · helpers `lib/auth.ts`, `lib/permissions.ts`,
`lib/audit.ts`, `lib/route-permissions.ts` · reescritura de `src/proxy.ts` con
permisos reales (revert de 001/002) · guards en las mutaciones de
`/api/products` y `/api/categories` · API `/api/admin/users`, `/api/admin/roles`,
`/api/admin/audit-logs` · módulos UI `users`, `roles`, `audit-logs` · páginas
`/admin/users`, `/admin/roles`, `/admin/audit-logs`, `/admin/forbidden` ·
sidebar filtrado por permiso · `/profile` con `<UserProfile />` de Clerk y el
cierre del alta por contraseña temporal (`POST /api/profile/password-changed`).

**No incluye:** CRUD de roles (los 6 son `is_system`, catálogo de solo lectura) ·
edición de la matriz rol × permiso desde UI · permisos sobre Pedidos/Clientes (son
ítems de nav sin página real) · página `/admin` (dashboard) — no existe hoy y sigue
sin existir · Clerk Organizations · invitación por email · reenvío de contraseña
temporal · purga por retención de `audit_logs` · storefront.

## 4. Criterios de aceptación

- [ ] AC1 — Dado `db:migrate && db:seed` sobre BD vacía, cuando se reejecuta el seed,
      entonces no falla ni duplica filas (idempotente) y `db:studio` muestra los 6
      roles de sistema y los 16 permisos con su matriz.
- [ ] AC2 — Dado un registro nuevo por email o por Google, cuando Clerk dispara
      `user.created`, entonces existe una fila en `users` con su `clerk_id`, una fila
      en `user_roles` con `customer` y una en `audit_logs`
      (`action: "user.auto_provisioned"`, `actor_id: null`).
- [ ] AC3 — Dado que aún no existe ningún `super_admin` y se registra el email de
      `ADMIN_BOOTSTRAP_EMAIL`, entonces recibe `super_admin` en vez de `customer`;
      un segundo registro con ese mismo email ya no lo recibe.
- [ ] AC4 — Dado un `employee` o un `customer` autenticado, cuando navega a cualquier
      ruta bajo `/admin`, entonces `proxy.ts` lo saca antes de renderizar el sidebar;
      `/profile` sí carga.
- [ ] AC5 — Dado un `audit`, cuando entra a `/admin`, entonces es redirigido a
      `/admin/audit-logs`; si intenta `/admin/products` o `/admin/users`, cae en
      `/admin/forbidden`; su sidebar muestra únicamente "Auditoría".
- [ ] AC6 — Dado un `manager`, cuando entra a `/admin/products`, entonces ve el listado
      pero `DELETE /api/products/[id]` responde `403`, y `PUT /api/admin/users/[id]/roles`
      responde `403`.
- [ ] AC7 — Dado un `admin` en `/admin/users`, cuando crea un usuario con email, nombre
      y rol `manager`, entonces la cuenta se crea en Clerk, la contraseña temporal se
      muestra **una sola vez** en la UI y no aparece en ninguna respuesta posterior,
      log ni fila de `audit_logs`.
- [ ] AC8 — Dado ese usuario nuevo, cuando hace su primer login, entonces `proxy.ts` lo
      redirige a `/profile` y no lo deja navegar a otra ruta protegida hasta que cambia
      la contraseña.
- [ ] AC9 — Dado un `admin`, cuando intenta asignar `super_admin` o `admin` a otro
      usuario, entonces recibe `403` con mensaje explicativo; el mismo `PUT` hecho por
      un `super_admin` responde `200`.
- [ ] AC10 — Dada cualquier mutación de `/api/admin/users/*`, cuando responde 2xx,
      entonces existe **exactamente una** fila nueva en `audit_logs` con `before`/`after`
      de los campos cambiados y sin contraseñas ni tokens en `changes`/`metadata`.
- [ ] AC11 — Dado un usuario con sesión activa a quien se le revoca el rol, cuando
      dispara una mutación, entonces el Route Handler responde `403` de inmediato
      (aunque el sidebar tarde hasta el próximo refresh de token).
- [ ] AC12 — Dado `GET /api/admin/audit-logs` sin `audit_logs.view`, entonces `403`;
      con el permiso, devuelve el listado filtrable por entidad, acción, actor y fecha.
- [ ] AC13 — Dado el widget de asignación de roles, cuando el admin abre "Ver qué
      incluye este rol", entonces ve los permisos en lenguaje llano (no códigos crudos).
- [ ] AC14 — Dado `src/proxy.ts` tras esta fase, entonces no queda ningún
      `isTemporarilyPublicAdminRoute` ni TODO(001)/TODO(002), y `002-products.md` §11
      queda marcado como resuelto por el 003.
- [ ] AC15 — `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

Seis tablas nuevas en `src/server/db/schema/`, mismo patrón que `category.ts` /
`product.ts` (tipos inferidos, nunca duplicados). Requiere migración
(`npm run db:generate && npm run db:migrate` → `drizzle/0002_*.sql`).

**`user.ts` → `users`**

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` |
| `clerk_id` | `varchar(64)` | NOT NULL, único |
| `email` | `varchar(255)` | NOT NULL, único |
| `first_name` / `last_name` | `varchar(80)` | NULL |
| `image_url` | `text` | NULL |
| `is_active` | `boolean` | NOT NULL, default `true` |
| `created_at` / `updated_at` | `timestamptz` | NOT NULL, `defaultNow()`, `$onUpdate` |

**`role.ts` → `roles`**: `id` uuid PK · `slug` varchar(40) único NOT NULL ·
`name` varchar(60) NOT NULL · `description` text NULL · `is_system` boolean NOT NULL
default `false` · timestamps.

**`permission.ts` → `permissions`**: `id` uuid PK · `code` varchar(60) único NOT NULL ·
`resource` varchar(40) NOT NULL · `action` varchar(40) NOT NULL · `description` text NULL ·
índice `permissions_resource_idx(resource)`.

**`role-permission.ts` → `role_permissions`**: `role_id` FK → `roles.id` ON DELETE
CASCADE · `permission_id` FK → `permissions.id` ON DELETE CASCADE · PK compuesta
(`role_id`, `permission_id`).

**`user-role.ts` → `user_roles`**: `user_id` FK → `users.id` ON DELETE CASCADE ·
`role_id` FK → `roles.id` **ON DELETE RESTRICT** · `assigned_by` FK → `users.id`
nullable ON DELETE SET NULL · `assigned_at` timestamptz NOT NULL `defaultNow()` ·
PK compuesta (`user_id`, `role_id`).

**`audit-log.ts` → `audit_logs`** (según `SETUP.md` §5.2): `id` uuid PK ·
`actor_id` FK → `users.id` nullable **ON DELETE SET NULL** · `action` text NOT NULL ·
`entity_type` text NOT NULL · `entity_id` text NULL · `changes` jsonb NULL
(`{before, after}`) · `metadata` jsonb NULL · `ip_address` `inet` NULL ·
`user_agent` text NULL · `severity` `pgEnum("audit_severity", ["info","warning","error"])`
NOT NULL default `info` · `created_at` timestamptz NOT NULL `defaultNow()`.
Índices: `(entity_type, entity_id)`, `(actor_id, created_at desc)`, `(action)`,
`(created_at desc)`. **Append-only**: el repositorio no expone `update` ni `remove`.

Barrel `src/server/db/schema/index.ts` pasa a reexportar también los 6 archivos.

### 5.1 Catálogo de roles y permisos (semilla)

Roles de sistema (`is_system = true`, no editables ni borrables desde UI):
`super_admin`, `admin`, `manager`, `employee`, `customer`, `audit`.

Permisos `<recurso>.<acción>` — solo recursos con página real:

| Recurso | Acciones |
|---|---|
| `dashboard` | `view` |
| `products` | `view`, `create`, `update`, `delete` |
| `categories` | `view`, `create`, `update`, `delete` |
| `users` | `view`, `create`, `update`, `deactivate`, `assign_roles` |
| `roles` | `view` |
| `audit_logs` | `view` |

Matriz rol → permiso (confirmada con el usuario, se siembra fila por fila):

| Rol | Permisos |
|---|---|
| `super_admin` | **todos** los códigos, uno por uno en `role_permissions` |
| `admin` | `dashboard.view`, `products.*`, `categories.*`, `users.view/create/update/assign_roles`, `roles.view`, `audit_logs.view` |
| `manager` | `dashboard.view`, `products.view`, `products.update`, `categories.view`, `users.view` |
| `audit` | **únicamente** `audit_logs.view` |
| `employee` | ninguno |
| `customer` | ninguno |

`admin` **no** puede asignar `super_admin` ni `admin` (§8.3). `employee` y
`customer` no tienen ningún permiso administrativo: su único destino propio en la
app es `/profile`.

## 6. Contratos de API

| Método | Ruta | Permiso | Body | Response |
|---|---|---|---|---|
| POST | `/api/webhooks/clerk` | público + firma Svix | evento Clerk | `200` · `400` firma inválida |
| GET | `/api/admin/users` | `users.view` | — | `200 UserListItem[]` · `403` |
| POST | `/api/admin/users` | `users.create` | `createUserSchema` | `201 { user, temporaryPassword }` · `400` · `403` · `409` |
| GET | `/api/admin/users/[id]` | `users.view` | — | `200 UserDetail` · `403` · `404` |
| PATCH | `/api/admin/users/[id]` | `users.update` (+ `users.deactivate` si toca `isActive`) | `updateUserSchema` | `200 User` · `400` · `403` · `404` |
| PUT | `/api/admin/users/[id]/roles` | `users.assign_roles` + jerarquía §8.3 | `assignRolesSchema` | `200 UserDetail` · `400` · `403` · `404` |
| GET | `/api/admin/roles` | `roles.view` | — | `200 RoleWithPermissions[]` · `403` |
| GET | `/api/admin/audit-logs` | `audit_logs.view` | query: `entityType`, `action`, `actorId`, `from`, `to`, `limit` | `200 AuditLogListItem[]` · `400` · `403` |
| POST | `/api/profile/password-changed` | solo sesión (autoservicio, §13.2) | — | `200 { mustChangePassword: false }` · `401` |

`UserListItem = User & { roles: { slug, name }[] }` (join en el repositorio, sin N+1
por fila). `temporaryPassword` se devuelve **solo** en la respuesta del `POST` y
jamás se persiste en tablas propias ni en `audit_logs`.

Cuerpo de error uniforme, igual que 001/002: `{ error: string, issues?: z.core.$ZodIssue[] }`.
El `403` de `requirePermission` responde `{ error: "No tienes permiso para esta acción" }`.

**Zod** (`src/modules/users/schemas/user.schema.ts`, Zod 4 → `z.uuid()`, `z.email()`):
- `createUserSchema`: `email` (`z.email()`), `firstName` (1–80), `lastName` (nullish, ≤80),
  `roleSlugs` (`z.array(z.string()).min(1)`).
- `updateUserSchema`: `firstName`/`lastName`/`isActive` parciales + `refine` no vacío.
- `assignRolesSchema`: `{ roleSlugs: z.array(z.string()).min(1) }` — reemplaza el set completo.
- `userIdSchema`: `z.uuid()`.
- `auditLogFiltersSchema` (`src/modules/audit-logs/schemas/audit-log.schema.ts`):
  filtros opcionales + `limit` (`z.coerce.number().int().min(1).max(200).default(100)`).

## 7. Reutilizar (verificado)

- `src/components/shared/data-table.tsx` — `DataTable`, `dataTableFeatures`,
  `DataTableFeatures`, `DataTableFilter`, tal cual (tablas de usuarios, roles y auditoría).
- `src/server/db/pg-errors.ts` — `isUniqueViolation`, `isForeignKeyViolation`, `findPgError`.
- `src/lib/axios.ts` (`api`) · `src/components/providers/query-provider.tsx`.
- `src/modules/products/services/product.service.ts` — replicar `getApiErrorMessage` /
  `isConflictError` en `user.service.ts` (copiar, no importar cruzado; regla de 002 §7).
- Patrón archivo por archivo: `product.repository.ts`, `app/api/products/route.ts` +
  `[id]/route.ts`, `product-columns.tsx`, `product-form-dialog.tsx` (RHF + `field` +
  `zodResolver` + `Controller`, **sin** wrapper `Form`), `products-table.tsx`,
  `use-product-mutations.ts`, `products/constants.ts` (query keys).
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — patrón de reuso de componente
  prebuilt de Clerk, a replicar en `/profile` con `<UserProfile />`.
- `src/components/shared/admin-sidebar.tsx` — se **extiende** (ícono `Users` ya importado).
- shadcn ya instalados: `alert-dialog`, `badge`, `button`, `card`, `dialog`,
  `dropdown-menu`, `field`, `input`, `label`, `select`, `separator`, `skeleton`,
  `sonner`, `switch`, `table`, `tabs`, `textarea`, `avatar`.
  **A instalar:** `npx shadcn@latest add checkbox popover tooltip`.
  `command`/combobox se difiere: `DataTable` ya cubre búsqueda y filtros.

## 8. Decisiones técnicas

**8.1 Clerk = autenticación, Postgres = autorización.** Roles y permisos viven en
Postgres. Clerk solo transporta un **caché derivado** (`publicMetadata` → custom
session claim) para que `proxy.ts` decida sin consultar la BD en cada navegación
(el middleware corre en Edge). Cada Route Handler mutante revalida contra Postgres
vía `requirePermission()`: doble check, y la autoridad real es Postgres.
Descartadas: query a Postgres en cada request de middleware (latencia + runtime
Edge) y Clerk Organizations (multi-tenant innecesario; el proyecto ya define su
propio catálogo de permisos).

**8.2 Verificación siempre por `permission.code`.** `requirePermission('products.create')`
en webhook, `proxy.ts` y Route Handlers. `role === 'admin'` es hallazgo bloqueante
(CLAUDE.md §4.8).

**8.3 Jerarquía de asignación — excepción justificada.** Asignar `super_admin` o
`admin` a otro usuario exige que el actor sea `super_admin`. Es la **única**
comprobación por slug de rol del spec y vive como regla de negocio dentro de
`PUT /api/admin/users/[id]/roles`, no en middleware: es escalamiento de privilegios,
no acceso a un recurso, y ningún `permission.code` puede expresarla sin inventar un
permiso por rol. Se documenta aquí para que el reviewer no la lea como violación de
§8.2.

**8.4 Alta de usuarios por contraseña temporal** (decisión del usuario, no invitación
por email). El admin envía email + nombre + roles iniciales;
`clerkClient.users.createUser()` crea la cuenta con una contraseña temporal generada
(`crypto.randomUUID()` recortado + símbolos, ≥12 caracteres), y marca
`publicMetadata.mustChangePassword = true` y `publicMetadata.pendingRoles` para que el
webhook `user.created` asigne esos roles en vez de `customer`. La contraseña se
devuelve una sola vez en el `201` y se muestra en un diálogo copiable; no se reenvía
ni se persiste en texto plano en ninguna tabla ni log. En el primer login `proxy.ts`
lee el claim `mustChangePassword` y fuerza el paso por `/profile` antes que cualquier
otra ruta protegida. El flag lo **limpia el propio usuario** desde `/profile` con
`POST /api/profile/password-changed` (Fase 7): no por webhook, porque `user.updated`
no distingue un cambio de contraseña de cualquier otra edición y
`syncClerkAccessMetadata()` genera sus propios `user.updated` (§13.2).

**8.5 Atomicidad mutación + `audit_logs` con `neon-http`.** Verificado:
`src/server/db/index.ts` usa `drizzle-orm/neon-http`, cuyo `transaction()` **lanza**
`"No transactions support in neon-http driver"`
(`node_modules/drizzle-orm/neon-http/session.cjs:176`). La regla dura CLAUDE.md §4.9
se cumple con **`db.batch([...])`**, que Neon ejecuta como una única transacción HTTP:
si una sentencia falla, revierten todas. Consecuencias de diseño, obligatorias:
- `src/lib/audit.ts` expone `buildAuditLogInsert(payload)` que **devuelve** la
  sentencia Drizzle en vez de ejecutarla; el llamador la incluye en el mismo `batch`
  que la mutación. Nombre del plan (`recordAuditLog`) se conserva como envoltorio de
  un solo uso (ejecución suelta) únicamente para eventos no transaccionales.
- Los ids de filas nuevas se generan en la app (`crypto.randomUUID()`) y se pasan
  explícitos, porque dentro de un `batch` no se puede alimentar una sentencia con el
  `returning()` de otra. Aplica a `users.id` en el webhook y a `audit_logs.entity_id`.
- Las lecturas previas (¿existe ya un `super_admin`?, ¿qué roles tenía antes?) se
  hacen **antes** del batch. Se acepta la ventana de carrera: §10.
Alternativa descartada por ahora: migrar `db` a `drizzle-orm/neon-serverless` (Pool
sobre WebSocket, transacciones interactivas reales) — añade dependencia `ws`, ciclo de
vida de pool en serverless y toca las dos fases ya entregadas. Se reevalúa si aparece
una mutación que necesite leer dentro de la transacción.

**8.6 Bootstrap del primer `super_admin`.** Variable `ADMIN_BOOTSTRAP_EMAIL`. En
`user.created`, si **no existe todavía ninguna fila `user_roles` con rol
`super_admin`** y el email del evento coincide, se asigna `super_admin` en vez de
`customer`. Es un paso de setup de un solo uso efectivo, no un mecanismo permanente:
en cuanto hay un `super_admin`, la rama queda muerta.

**8.7 `/admin` raíz y el rol `audit`.** El dashboard (`(admin)/admin/page.tsx`)
**no existe** hoy y sigue fuera de alcance. Aun así `proxy.ts` trata `/admin` como
ruta con permiso mínimo `dashboard.view`; si el usuario no lo tiene pero sí tiene
otro permiso admin (caso `audit`), se redirige a la primera sección accesible
(`/admin/audit-logs`) en vez de a `/admin/forbidden`. Evita que un rol válido quede
atrapado sin destino.

**8.8 Verbo HTTP y matcher.** `createRouteMatcher` no distingue método, así que
`proxy.ts` no puede dejar público el `GET /api/products` y cerrar el `POST`. Las
mutaciones de `/api/products` y `/api/categories` exigen su permiso **dentro del
propio Route Handler** con `requirePermission`; los `GET` siguen públicos para el
storefront futuro. `/admin/*` sí se resuelve por ruta en el middleware
(`src/lib/route-permissions.ts`).

**8.9 `/profile` fuera de `(admin)`.** `src/app/profile/[[...profile]]/page.tsx`
reutiliza `<UserProfile />` de `@clerk/nextjs` (mismo patrón que `sign-in`/`sign-up`,
sin UI custom): cubre ver/editar datos y cambiar contraseña para cualquier usuario
autenticado, incluidos `employee` y `customer`. **No** se añade a `isPublicRoute` ni a
`isAdminRoute`: cae en la rama por defecto (`auth.protect()`). Lo único propio de la
página es el aviso de la Fase 7, que solo se renderiza si el claim
`mustChangePassword` es `true`.

**8.10 Roles sin CRUD.** Los 6 son `is_system`; `/admin/roles` es catálogo de solo
lectura (`roles.view`). Un CRUD de roles con matriz editable sería superficie sin
consumidor real en esta fase (CLAUDE.md §6).

## 9. Tareas

### Fase 1 — Esquema y semilla (sin efecto en runtime)

- [x] T1 — Instalar shadcn faltantes: `npx shadcn@latest add checkbox popover tooltip` · `src/components/ui/{checkbox,popover,tooltip}.tsx`
- [x] T2 — Añadir `ADMIN_BOOTSTRAP_EMAIL=""` · `.env.example` (y documentar en `.env.local`)
- [x] T3 — Tabla `users` + tipos inferidos · `src/server/db/schema/user.ts`
- [x] T4 — Tabla `roles` · `src/server/db/schema/role.ts`
- [x] T5 — Tabla `permissions` + índice por `resource` · `src/server/db/schema/permission.ts`
- [x] T6 — Pivote `role_permissions` (PK compuesta, FKs cascade) · `src/server/db/schema/role-permission.ts`
- [x] T7 — Pivote `user_roles` (PK compuesta, `roleId` RESTRICT, `assignedBy`, `assignedAt`) · `src/server/db/schema/user-role.ts`
- [x] T8 — Tabla `audit_logs` + `pgEnum` de severidad + los 4 índices de §5 · `src/server/db/schema/audit-log.ts`
- [x] T9 — Reexportar los 6 schemas en el barrel · `src/server/db/schema/index.ts`
- [x] T10 — Generar y aplicar migración · `npm run db:generate && npm run db:migrate` · `drizzle/0002_*.sql`
- [x] T11 — Seed idempotente (`onConflictDoNothing` por `code`/`slug`): 16 permisos, 6 roles de sistema y la matriz de §5.1 · `src/server/db/seed.ts` · verificación: `npm run db:seed` dos veces seguidas, sin duplicados
- [x] T12 — `user.repository.ts`: `findAllWithRoles`, `findById`, `findByClerkId`, `findByEmail`, `create`, `update`, `setActive`, y **`findRolesAndPermissionsByClerkId(clerkId)`** (join `users ⋈ user_roles ⋈ roles ⋈ role_permissions ⋈ permissions`, permisos deduplicados) · `src/server/repositories/user.repository.ts`
- [x] T13 — `role.repository.ts`: `findAll`, `findBySlugs`, `findAllWithPermissions`, `existsUserWithRoleSlug(slug)` (para el bootstrap de §8.6) · `src/server/repositories/role.repository.ts`
- [x] T14 — `permission.repository.ts`: `findAll`, `findByRoleIds` · `src/server/repositories/permission.repository.ts`
- [x] T15 — `user-role.repository.ts`: `findByUserId`, `buildReplaceForUser(userId, roleIds, assignedBy)` que devuelve las sentencias (delete + inserts) para el `batch` de §8.5 · `src/server/repositories/user-role.repository.ts`
- [x] T16 — `audit-log.repository.ts` **append-only** (`findMany` con filtros de §6 + `buildInsert`; sin `update` ni `remove`) · `src/server/repositories/audit-log.repository.ts`

### Fase 2 — Sincronización Clerk → Postgres

- [x] T17 — `buildAuditLogInsert(payload)` + `recordAuditLog(payload)` no transaccional; enmascarado de campos sensibles (nunca contraseñas ni tokens) · `src/lib/audit.ts`
- [x] T18 — Servicio de sincronización: resuelve permisos efectivos y escribe `publicMetadata.roles/permissions` en Clerk vía `clerkClient()` · `src/server/services/user-access.service.ts`
- [x] T19 — Webhook: `verifyWebhook` de `@clerk/nextjs/webhooks`; `user.created` (upsert `ON CONFLICT (clerk_id)` + roles desde `pendingRoles` | bootstrap §8.6 | `customer`, todo en un `db.batch` junto al `audit_logs` `user.auto_provisioned` con `actorId: null`, y luego T18), `user.updated` (email/nombre/imagen, sin tocar roles), `user.deleted` (`isActive = false`) · `src/app/api/webhooks/clerk/route.ts`
- [x] T20 — Añadir `/api/webhooks(.*)` a `isPublicRoute` (hoy no está: el webhook recibiría 401) · `src/proxy.ts`
- [x] T21 — Setup operativo (documentar, no código): endpoint registrado en el Dashboard de Clerk, `clerk webhooks listen --forward-to localhost:3000/api/webhooks/clerk` en local, y **custom session token claim** que exponga `publicMetadata.permissions`, `roles` y `mustChangePassword` en `sessionClaims` · nota en este spec §12

### Fase 3 — Helpers de autorización y `proxy.ts` real (cambia comportamiento existente)

- [x] T22 — Tipar `CustomJwtSessionClaims` (`roles`, `permissions`, `mustChangePassword`) · `src/types/globals.d.ts`
- [x] T23 — `getCurrentUser()` server-only memoizado con `cache()` de React sobre `auth()` + T12 · `src/lib/auth.ts`
- [x] T24 — `PERMISSIONS` (códigos como constantes), `can(code, user)`, `requirePermission(code)` para Route Handlers (devuelve `NextResponse.json(403)`) y variante para Server Components · `src/lib/permissions.ts`
- [x] T25 — Mapa ruta → permiso mínimo para `/admin/*` y `/api/admin/*` + `getRequiredPermission(pathname)` + `getFirstAllowedAdminPath(permissions)` (§8.7) · `src/lib/route-permissions.ts`
- [x] T26 — Reescribir `proxy.ts`: eliminar `isTemporarilyPublicAdminRoute` y los TODO(001)/(002); mantener `isPublicRoute` (+ webhooks); si `sessionClaims.mustChangePassword` → redirigir a `/profile`; en `isAdminRoute` comparar `sessionClaims.permissions` contra `getRequiredPermission()` → `/admin/forbidden`, con el caso especial de `/admin` de §8.7 · `src/proxy.ts`
- [x] T27 — `requirePermission('products.create'|'products.update'|'products.delete')` en `POST`/`PATCH`/`DELETE`; `GET` sigue público · `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`
- [x] T28 — Ídem con `categories.*` · `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`
- [x] T29 — Marcar la deuda como resuelta por el 003 en §11 · `docs/specs/002-products.md`

### Fase 4 — API de administración

- [x] T30 — Schemas Zod de §6 · `src/modules/users/schemas/user.schema.ts`
- [x] T31 — `GET` (listado con roles) + `POST` (crea en Clerk con contraseña temporal, `pendingRoles`, `mustChangePassword`; devuelve `temporaryPassword` una única vez; 409 si el email existe) · `src/app/api/admin/users/route.ts`
- [x] T32 — `GET` detalle + `PATCH` (perfil / `isActive`, con `users.deactivate` para el toggle), mutación y `audit_logs` en el mismo `db.batch` · `src/app/api/admin/users/[id]/route.ts`
- [x] T33 — `PUT` que reemplaza el set de roles: jerarquía de §8.3, `batch` con delete + inserts + `audit_logs` (`role.assigned` / `role.revoked`, `before`/`after` con los slugs), refresco de `publicMetadata` vía T18 · `src/app/api/admin/users/[id]/roles/route.ts`
- [x] T34 — `GET` catálogo de roles con sus permisos · `src/app/api/admin/roles/route.ts`
- [x] T35 — `GET` de auditoría con los filtros de §6 y `limit` acotado · `src/app/api/admin/audit-logs/route.ts`

### Fase 5 — UI de administración de usuarios y perfil

- [x] T36 — Diccionario estático `permission.code` → texto llano en español (`"products.delete" → "Puede eliminar productos"`) · `src/modules/roles/constants/permission-labels.ts`
- [x] T37 — `userKeys`, `roleKeys` y opciones de filtro de estado · `src/modules/users/constants.ts`, `src/modules/roles/constants.ts`
- [x] T38 — Reexport de tipos con `import type` desde los schemas Drizzle · `src/modules/users/types/user.types.ts`
- [x] T39 — Service axios (`getUsers`, `createUser`, `updateUser`, `assignRoles`) + `getApiErrorMessage`/`isConflictError` replicados · `src/modules/users/services/user.service.ts`
- [x] T40 — Service + hook de roles (`getRoles`, `useRoles`) · `src/modules/roles/services/role.service.ts`, `src/modules/roles/hooks/use-roles.ts`
- [x] T41 — `useUsers()` · `src/modules/users/hooks/use-users.ts`
- [x] T42 — `useCreateUser`, `useUpdateUser`, `useAssignRoles` con invalidación y toasts en español · `src/modules/users/hooks/use-user-mutations.ts`
- [x] T43 — `RoleAssignmentField`: lista vertical de los 6 roles con nombre y descripción en español y un `Switch` por rol; `Popover` "Ver qué incluye este rol" que traduce los códigos con T36; oculta `super_admin`/`admin` si el actor no es `super_admin` (§8.3) · `src/modules/users/components/role-assignment-field.tsx`
- [x] T44 — Diálogo de alta/edición (RHF + `field` + `zodResolver`; email solo en alta) que integra T43 · `src/modules/users/components/user-form-dialog.tsx`
- [x] T45 — Diálogo que muestra la contraseña temporal una sola vez, con botón de copiar y aviso de que no se podrá volver a ver · `src/modules/users/components/temporary-password-dialog.tsx`
- [x] T46 — Columnas: Nombre, Email, Roles (`Badge` por rol), Estado, Alta, y acciones (Editar, Asignar roles, Activar/Desactivar) · `src/modules/users/components/user-columns.tsx`
- [x] T47 — Tabla orquestadora con filtros por rol y estado y botón "Nuevo usuario" · `src/modules/users/components/users-table.tsx`
- [x] T48 — Página de usuarios · `src/app/(admin)/admin/users/page.tsx`
- [x] T49 — Tabla de solo lectura del catálogo de roles con sus permisos en lenguaje llano · `src/modules/roles/components/roles-table.tsx`
- [x] T50 — Página de roles (solo lectura) · `src/app/(admin)/admin/roles/page.tsx`
- [x] T51 — Página 403 en español con enlace a la primera sección accesible · `src/app/(admin)/admin/forbidden/page.tsx`
- [x] T52 — Layout admin: `getCurrentUser()` server-side, redirige si no hay sesión o el usuario está inactivo, y pasa los permisos al sidebar · `src/app/(admin)/admin/layout.tsx`
- [x] T53 — `NavItem` gana `requiredPermission?: string`; el sidebar filtra por los permisos recibidos; nuevas entradas Usuarios (`users.view`, ícono `Users`) y Auditoría (`audit_logs.view`, ícono `ScrollText`); Pedidos/Clientes quedan sin guard · `src/components/shared/admin-sidebar.tsx`
- [x] T54 — Página de perfil con `<UserProfile />` de Clerk, fuera de `(admin)` · `src/app/profile/[[...profile]]/page.tsx`

### Fase 6 — UI de auditoría

- [x] T55 — Types, `auditLogKeys` y service axios con query params · `src/modules/audit-logs/{types,constants.ts,services}/...`
- [x] T56 — `useAuditLogs(filters)` · `src/modules/audit-logs/hooks/use-audit-logs.ts`
- [x] T57 — Columnas de solo lectura: fecha, actor, acción, entidad, severidad (`Badge`) y `Popover` con el JSON de `changes` formateado · `src/modules/audit-logs/components/audit-log-columns.tsx`
- [x] T58 — Tabla con filtros por entidad, acción, actor y rango de fechas · `src/modules/audit-logs/components/audit-logs-table.tsx`
- [x] T59 — Página de auditoría (destino único del rol `audit`) · `src/app/(admin)/admin/audit-logs/page.tsx`

### Fase 7 — Cierre de AC8 (corrección de review, iteración 1)

Nada limpiaba `publicMetadata.mustChangePassword`, así que el usuario dado de alta
desde el panel quedaba encerrado en `/profile` de forma permanente. Se resuelve con
una confirmación explícita del propio usuario, no por webhook (§13.2).

- [x] T60 — `POST /api/profile/password-changed`: autoservicio sobre la propia cuenta
      (solo exige sesión de Clerk, sin `permission.code`, con el `clerkId` tomado de la
      sesión y nunca del body); limpia `mustChangePassword` vía
      `clerkClient().users.updateUserMetadata()` y registra `user.password_change_confirmed`
      con `recordAuditLog` (la mutación vive en Clerk, no hay `batch` al que sumarse, §8.5) ·
      `src/app/api/profile/password-changed/route.ts`, `src/lib/audit.ts`
- [x] T61 — Módulo `profile`: service axios + hook de mutación (que además fuerza un token
      fresco con `getToken({ skipCache: true })`, porque `proxy.ts` decide con el claim del
      JWT) + aviso "Ya cambié mi contraseña" con estados de carga y error ·
      `src/modules/profile/{services/profile.service.ts,hooks/use-confirm-password-changed.ts,components/password-change-notice.tsx}`
- [x] T62 — `/profile` lee el claim `mustChangePassword` server-side y solo entonces
      renderiza el aviso, calculando el destino posterior con `getFirstAllowedAdminPath()` ·
      `src/app/profile/[[...profile]]/page.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer),
más la matriz rol × ruta de §10 comprobada con un usuario por rol.

## 10. Verificación end-to-end — matriz rol × ruta

`✓` accede · `→X` redirige a X · `403` prohibido.

| Ruta / acción | super_admin | admin | manager | audit | employee | customer |
|---|---|---|---|---|---|---|
| `/admin` | ✓ | ✓ | ✓ | →`/admin/audit-logs` | →`/admin/forbidden` | →`/admin/forbidden` |
| `/admin/products` | ✓ | ✓ | ✓ | →forbidden | →forbidden | →forbidden |
| `DELETE /api/products/[id]` | 200 | 200 | 403 | 403 | 403 | 403 |
| `POST /api/categories` | 201 | 201 | 403 | 403 | 403 | 403 |
| `/admin/users` | ✓ | ✓ | ✓ (solo lectura) | →forbidden | →forbidden | →forbidden |
| `POST /api/admin/users` | 201 | 201 | 403 | 403 | 403 | 403 |
| `PUT .../roles` con `manager` | 200 | 200 | 403 | 403 | 403 | 403 |
| `PUT .../roles` con `super_admin` | 200 | **403** (§8.3) | 403 | 403 | 403 | 403 |
| `/admin/roles` | ✓ | ✓ | →forbidden | →forbidden | →forbidden | →forbidden |
| `/admin/audit-logs` | ✓ | ✓ | →forbidden | ✓ | →forbidden | →forbidden |
| `/profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Casos adicionales obligatorios: alta de usuario por `admin` → contraseña temporal
visible una sola vez → primer login redirige a `/profile` hasta cambiarla ·
revocación de rol con sesión activa → mutación `403` inmediata · ninguna contraseña
ni token en `audit_logs.metadata`.

## 11. Riesgos

- **Carrera en el bootstrap.** La comprobación "¿ya existe algún `super_admin`?" ocurre
  fuera del batch (§8.5). Dos `user.created` simultáneos con el email de bootstrap
  podrían crear dos `super_admin`. Improbable (es un alta manual y única) y sin daño
  real; si preocupa, se mitiga con un índice único parcial en una fase posterior.
- **Caché de permisos rancio.** `publicMetadata` viaja en el JWT; revocar un rol no
  invalida la sesión activa. El sidebar puede mostrar secciones ya prohibidas hasta el
  refresh del token, pero toda mutación falla con 403 porque el Route Handler consulta
  Postgres. Es el comportamiento esperado (AC11), no un bug.
- **Cerrar el acceso público rompe el flujo actual.** La Fase 3 revierte 001/002: si
  se despliega sin un `super_admin` sembrado, nadie puede entrar a `/admin`. Orden
  obligatorio: fases 1-2 y un usuario de bootstrap **antes** de T26.
- **Webhook no registrado = usuarios fantasma.** Sin el endpoint dado de alta en Clerk,
  el usuario existe en Clerk y no en Postgres → `getCurrentUser()` devuelve `null` y
  queda bloqueado en todas partes. `lib/auth.ts` debe distinguir "sin permisos" de
  "sin fila en `users`" y el mensaje de `/admin/forbidden` no debe atribuirlo a falta
  de permisos.
- **Custom session claim no configurado.** Si el claim no expone `permissions`,
  `sessionClaims.permissions` llega `undefined` y `proxy.ts` bloquearía a todo el
  mundo. Tratar `undefined` como "sin permisos" y verificarlo en T21 antes de T26.
- **`createRouteMatcher` deprecado** (memoria de proyecto). Esta fase sigue con ese
  patrón: migrarlo y reescribir la lógica de permisos a la vez multiplicaría el riesgo.
  Queda para un spec propio.
- **N+1 en el listado de usuarios.** `findAllWithRoles` debe resolver los roles con un
  join agregado, no con una consulta por fila.
- **`/admin` sin página.** `(admin)/admin/page.tsx` no existe: `super_admin`, `admin` y
  `manager` pasarán el guard y verán un 404. Es deuda previa a este spec (dashboard
  fuera de alcance), pero conviene que el reviewer no lo lea como fallo del RBAC.
- **Rollback.** Revertir implica `DROP` de las 6 tablas + el enum, restaurar
  `proxy.ts` a su versión actual y borrar los archivos nuevos. Los usuarios de Clerk
  no se tocan.

## 12. Setup operativo (fuera de código)

1. Registrar `POST /api/webhooks/clerk` en el Dashboard de Clerk con los eventos
   `user.created`, `user.updated`, `user.deleted`; copiar el secret a
   `CLERK_WEBHOOK_SIGNING_SECRET` (ya presente en `.env.example`).
2. En local: `clerk webhooks listen --forward-to localhost:3000/api/webhooks/clerk`.
3. Configurar el **custom session token claim** para exponer `publicMetadata.permissions`,
   `publicMetadata.roles` y `publicMetadata.mustChangePassword` en `sessionClaims`.
4. Definir `ADMIN_BOOTSTRAP_EMAIL` en `.env.local` y registrar ese usuario **una vez**
   para obtener el primer `super_admin`.

## 13. Notas de implementación (developer → reviewer)

1. **Son 16 permisos, no 21.** La tabla de §5.1 enumera exactamente 16 códigos
   (`dashboard` 1 · `products` 4 · `categories` 4 · `users` 5 · `roles` 1 ·
   `audit_logs` 1). AC1 y T11 decían "21" por un error de conteo del propio spec,
   no por un recorte de alcance: **ya está corregido a 16 en ambos sitios**. Se
   sembraron los 16 de la tabla y 37 filas en `role_permissions`.
   `PERMISSION_CATALOG` en `seed.ts` está tipado como `Record<PermissionCode, …>`,
   así que añadir un código sin sembrarlo rompe `typecheck`.

2. **AC8 completo desde la Fase 7.** El alta marca
   `publicMetadata.mustChangePassword = true` y `proxy.ts` fuerza el paso por
   `/profile`; el flag se limpia con `POST /api/profile/password-changed`, que el
   propio usuario dispara desde el aviso "Ya cambié mi contraseña" de `/profile`.

   **Por qué no se detecta por webhook:** el payload de `user.updated` de Clerk no
   expone ningún campo que distinga un cambio de contraseña de cualquier otra
   actualización de perfil (`UserJSON` no tiene `password_last_updated_at`), y
   `syncClerkAccessMetadata()` dispara sus propios `user.updated`, así que
   limpiarlo "en cualquier `user.updated`" lo borraría de inmediato tras el alta.
   Se opta por una confirmación explícita del usuario: es deliberadamente simple
   y honesta sobre lo que garantiza.

   **Límite conocido, asumido:** el endpoint confía en la palabra del usuario, no
   comprueba contra Clerk que la contraseña haya cambiado de verdad. Quien no la
   cambie y confirme igualmente sale del bloqueo, pero solo se perjudica a sí
   mismo: la contraseña temporal ya está en su poder y no da acceso a nada que su
   sesión activa no tenga. Cerrar ese hueco exigiría un flujo de cambio de
   contraseña a medida (`useUser().updatePassword()`) en lugar de `<UserProfile />`,
   fuera del alcance de esta corrección.

   **Refresco del claim:** `proxy.ts` decide con `sessionClaims`, no con
   `publicMetadata`, así que el hook pide un token fresco
   (`getToken({ skipCache: true })`) antes de navegar; sin eso el usuario rebotaría
   a `/profile` hasta el refresco periódico de la sesión.

3. **Ajustes menores respecto de la letra del spec, todos comentados en código:**
   - `POST /api/admin/users` crea la fila de Postgres, sus `user_roles` y su
     `audit_logs` en un único `batch` (no delega en el webhook), y el webhook
     `user.created` no reaudita si la fila ya existe: así hay **exactamente una**
     fila de auditoría por mutación (AC10). `pendingRoles` se conserva como red
     de seguridad si el batch falla tras crear la cuenta en Clerk.
   - La jerarquía de §8.3 se aplica también en `POST /api/admin/users` (crear con
     rol `admin` es la misma escalada) y al **retirar** un rol privilegiado, no
     solo al concederlo. Vive en `src/app/api/admin/users/_shared.ts`.
   - `admin` no tiene `users.deactivate` (así lo fija la matriz de §5.1): el
     toggle Activar/Desactivar se le muestra deshabilitado.
   - En el sidebar, "Editar" y "Asignar roles" abren el mismo diálogo (T44
     integra T43); no hay un tercer diálogo solo para roles.
   - `src/server/db/batch.ts` (nuevo, no listado en §9) encapsula el
     estrechamiento de tipo que exige `db.batch()` sobre arrays de longitud
     variable, usado por el webhook y por las tres mutaciones de `/api/admin/users`.
   - `requirePermissionInPage()` redirige a `/admin/forbidden` en vez de usar
     `forbidden()` de Next, que exige el flag experimental `authInterrupts`.
   - El layout de `(admin)` manda a `/profile` —no a `/admin/forbidden`— a los
     usuarios sin fila en `users` o desactivados: `/admin/forbidden` está dentro
     del propio layout y redirigir ahí haría bucle.

4. **Pendiente de setup operativo antes de probar (§12).** Sin el webhook dado de
   alta en Clerk y sin el custom session token claim que exponga
   `publicMetadata.permissions`, `roles` y `mustChangePassword`, `proxy.ts` trata
   a todo el mundo como "sin permisos" y nadie entra a `/admin`. La matriz rol ×
   ruta de §10 no se ha podido verificar end-to-end por esto.
