# Funciones testeables por módulo

Inventario de funciones exportadas con lógica propia (cálculos, validaciones,
transformaciones, mapeos, reglas de negocio, acceso a datos, manejo de errores)
candidatas a pruebas unitarias. **Excluye** componentes React, hooks de UI
(`useXxx` con `useState`/`useQuery`/`useMutation`) y Route Handlers (dependen de
`Request`/`Response` de Next.js y orquestan, no calculan).

Columna **Dependencia**: `Pura` = sin efectos externos, testeable sin mocks.
`DB` / `HTTP` / `Stripe` / `Clerk` = necesita un mock o stub de esa pieza.

---

## 1. Núcleo compartido (`src/lib`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `cn(...inputs)` | `lib/utils.ts` | Combina clases de Tailwind con `clsx` + `twMerge`, resolviendo conflictos de utilidades. | Pura |
| `getApiErrorMessage(error, fallback)` | `lib/api-error.ts` | Extrae el mensaje `error` del cuerpo de una respuesta axios fallida; si no hay uno válido, devuelve el `fallback`. | Pura (recibe el error ya armado) |
| `isOptimizableImageUrl(imageUrl)` | `lib/image.ts` | Determina si el host de una URL de imagen está en la lista optimizable por `next/image`; `null` o URL inválida cuentan como optimizable. | Pura |
| `getAppUrl()` | `lib/app-url.ts` | Lee `NEXT_PUBLIC_APP_URL`, lanza si falta, y recorta la barra final. | Pura (lee `process.env`) |
| `can(code, user)` | `lib/permissions.ts` | Verifica si un usuario activo tiene un código de permiso concreto. | Pura |
| `requirePermission(code)` | `lib/permissions.ts` | Guard de Route Handler: resuelve el usuario actual y devuelve `ok`/403/401 según tenga el permiso. | DB (vía `getCurrentUser`), Clerk |
| `requirePermissionInPage(code)` | `lib/permissions.ts` | Variante para Server Components: redirige en vez de devolver una respuesta JSON. | DB, Clerk |
| `getCurrentUser()` / `getCurrentUserState()` | `lib/auth.ts` | Resuelve el usuario autenticado y su set de roles/permisos efectivo desde Postgres. | DB, Clerk |
| `getRequiredPermission(pathname)` | `lib/route-permissions.ts` | Dado un pathname de `/admin/*` o `/api/admin/*`, devuelve el permiso mínimo requerido (o `undefined` si es libre). | Pura |
| `getFirstAllowedAdminPath(permissions)` | `lib/route-permissions.ts` | Primera sección del panel accesible según la lista de permisos del usuario, o `null`. | Pura |
| `buildAuditLogInsert(payload)` | `lib/audit.ts` | Enmascara campos sensibles (`password`, `token`, etc.) y arma la sentencia de inserción en `audit_logs`, sin ejecutarla. | Pura (arma SQL, no ejecuta) |
| `recordAuditLog(payload)` | `lib/audit.ts` | Ejecuta en solitario un insert de auditoría cuando no acompaña a ninguna mutación. | DB |
| `getRequestAuditContext(request)` | `lib/audit.ts` | Extrae IP y user-agent de los headers de un `Request`, validando que la IP tenga formato IPv4/IPv6. | Pura (recibe headers ya armados) |

> Nota: `lib/audit.ts` tiene lógica interna no exportada (`maskValue`, `maskRecord`, `maskChanges`, `isIpAddress`) que concentra las reglas más sensibles (qué se redacta, qué cuenta como IP válida). Hoy solo se cubre indirectamente a través de `buildAuditLogInsert`/`getRequestAuditContext`; si se quiere una prueba unitaria enfocada, requeriría exportarlas.

---

## 2. Capa de datos y repositorios (`src/server`)

### 2.1 Utilidades de base de datos (`server/db`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `findPgError(error)` | `server/db/pg-errors.ts` | Recorre la cadena `cause` de un error de Drizzle/Postgres hasta encontrar el código y constraint del driver. | Pura |
| `isUniqueViolation(error)` | `server/db/pg-errors.ts` | Indica si el error corresponde a una violación de unicidad (`23505`). | Pura |
| `isForeignKeyViolation(error)` | `server/db/pg-errors.ts` | Indica si el error corresponde a una violación de FK (`23503`/`23001`). | Pura |
| `runBatch(statements)` | `server/db/batch.ts` | Ejecuta un array de sentencias Drizzle como una única transacción HTTP de Neon; no hace nada si el array está vacío. | DB |

### 2.2 Identidad y acceso — roles, permisos, usuarios

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `findAll()` | `server/repositories/role.repository.ts` | Lista todos los roles ordenados por nombre. | DB |
| `findBySlugs(slugs)` | `server/repositories/role.repository.ts` | Busca roles por una lista de slugs. | DB |
| `findAllWithPermissions()` | `server/repositories/role.repository.ts` | Lista roles con sus códigos de permiso agregados en memoria desde un único join. | DB |
| `existsUserWithRoleSlug(slug)` | `server/repositories/role.repository.ts` | Indica si ya hay algún usuario con ese rol (usado para el bootstrap del primer `super_admin`). | DB |
| `findAll()` | `server/repositories/permission.repository.ts` | Lista todos los permisos ordenados por recurso/acción. | DB |
| `findByRoleIds(roleIds)` | `server/repositories/permission.repository.ts` | Permisos efectivos (deduplicados) de un conjunto de roles. | DB |
| `findByUserId(userId)` | `server/repositories/user-role.repository.ts` | Roles asignados a un usuario. | DB |
| `buildReplaceForUser(userId, roleIds, assignedBy)` | `server/repositories/user-role.repository.ts` | Arma las sentencias (delete + insert) para reemplazar el set completo de roles de un usuario, sin ejecutarlas. | Pura (arma SQL) |
| `buildInsertForUser(userId, roleIds, assignedBy)` | `server/repositories/user-role.repository.ts` | Arma la sentencia de alta inicial de roles de un usuario nuevo. | Pura (arma SQL) |
| `findById(id)` / `findByClerkId(id)` / `findByEmail(email)` | `server/repositories/user.repository.ts` | Búsquedas puntuales de un usuario. | DB |
| `findAllWithRoles()` / `findByIdWithRoles(id)` | `server/repositories/user.repository.ts` | Listado/detalle de usuarios con sus roles agregados en memoria (`groupRolesByUser`). | DB |
| `findRolesAndPermissionsByClerkId(clerkId)` | `server/repositories/user.repository.ts` | Resuelve el set de acceso efectivo completo (roles + permisos deduplicados) de un usuario. | DB |
| `buildUpsertByClerkId(data)` | `server/repositories/user.repository.ts` | Arma el upsert por `clerk_id` para el webhook de sincronización, sin ejecutar. | Pura (arma SQL) |
| `buildUpdate(id, data)` / `buildDeactivateByClerkId(clerkId)` | `server/repositories/user.repository.ts` | Arman sentencias de actualización/baja lógica sin ejecutar. | Pura (arma SQL) |
| `attachStripeCustomerId(userId, stripeCustomerId)` | `server/repositories/user.repository.ts` | Enlaza el Customer de Stripe solo si el usuario todavía no tiene uno (protección de condición de carrera). | DB |
| `update(id, data)` / `setActive(id, isActive)` | `server/repositories/user.repository.ts` | Actualizan datos o el estado activo/inactivo de un usuario. | DB |
| `isSuperAdmin(actor)` | `app/api/admin/users/_shared.ts` | Indica si el actor tiene el rol `super_admin`. | Pura |
| `checkRoleHierarchy(actor, requestedSlugs, currentSlugs)` | `app/api/admin/users/_shared.ts` | Rechaza (403) un cambio de roles privilegiados si quien lo pide no es `super_admin`. | Pura |
| `generateTemporaryPassword()` | `app/api/admin/users/_shared.ts` | Genera la contraseña temporal del alta de usuario desde el panel. | Pura (usa `crypto.randomUUID`) |
| `isPrivilegedRoleSlug(slug)` | `modules/roles/constants.ts` | Indica si un slug de rol es `super_admin` o `admin`. | Pura |
| `getPermissionLabel(code)` | `modules/roles/constants/permission-labels.ts` | Traduce un código de permiso a su etiqueta en español; cae al propio código si es desconocido. | Pura |

### 2.3 Auditoría

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `findMany(filters)` | `server/repositories/audit-log.repository.ts` | Lista la bitácora filtrada (entidad, acción, actor, rango de fechas) con el nombre/email del actor ya resuelto. | DB |
| `buildInsert(values)` | `server/repositories/audit-log.repository.ts` | Arma la sentencia de inserción de un registro de auditoría, sin ejecutar. | Pura (arma SQL) |

### 2.4 Catálogo — categorías y productos

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `findAll()` / `findActiveWithProductCount()` | `server/repositories/category.repository.ts` | Listan categorías; la segunda agrega el conteo de productos activos por categoría. | DB |
| `findById(id)` / `findBySlug(slug, excludeId?)` | `server/repositories/category.repository.ts` | Búsquedas puntuales de categoría, con exclusión opcional de un id (para validar unicidad en edición). | DB |
| `create(data)` / `update(id, data)` / `remove(id)` | `server/repositories/category.repository.ts` | CRUD de categorías. | DB |
| `getViolatedConstraint(error)` | `server/repositories/product.repository.ts` | Identifica cuál índice único (slug o SKU) chocó, a partir del error de Postgres. | Pura |
| `findAll()` | `server/repositories/product.repository.ts` | Lista productos vivos (no soft-deleted) con el nombre de categoría. | DB |
| `findPublic(filters)` / `countPublic(filters)` / `findPublicBrands()` | `server/repositories/product.repository.ts` | Catálogo público filtrado (categoría, marca, precio, stock, búsqueda, oferta) y su conteo/marcas disponibles. La construcción del `where` (`publicWhere`) y del `orderBy` (`publicOrderBy`) es lógica de negocio pura, aunque no exportada. | DB |
| `findPublicBySlug(slug)` | `server/repositories/product.repository.ts` | Ficha pública de un producto por slug, respetando las reglas de visibilidad. | DB |
| `findSimilar(row, limit?)` | `server/repositories/product.repository.ts` | Heurística de "productos parecidos": misma marca primero, luego menor distancia de precio, luego más reciente. | DB |
| `findById(id)` / `findBySlug(slug, excludeId?)` / `findBySku(sku, excludeId?)` | `server/repositories/product.repository.ts` | Búsquedas puntuales de producto vivo. | DB |
| `create(data)` / `update(id, data)` / `remove(id)` | `server/repositories/product.repository.ts` | Alta, edición y baja lógica (soft delete) de producto. | DB |
| `buildStockDecrement(productId, quantity, orderId)` | `server/repositories/product.repository.ts` | Arma el descuento de stock del fulfillment, con guarda de idempotencia (`exists` pedido `pending`) y piso en cero (`greatest`), sin ejecutar. | Pura (arma SQL) |
| `conflictFromUniqueViolation(error)` | `app/api/products/_shared.ts` | Traduce una violación de unicidad de producto en la respuesta 409 con el mensaje correcto (slug o SKU). | Pura |

### 2.5 Pedidos y pagos

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `createWithItems(values, items)` | `server/repositories/order.repository.ts` | Inserta cabecera y líneas de un pedido en un único batch atómico. | DB |
| `findByStripeCheckoutSessionId(sessionId)` | `server/repositories/order.repository.ts` | Busca el pedido asociado a una sesión de Stripe (reconciliación del webhook). | DB |
| `findWithItems(orderId)` / `findByIdAndUserId(orderId, userId)` | `server/repositories/order.repository.ts` | Detalle de pedido con líneas; la segunda variante acota por dueño. | DB |
| `findHistoryByUserId(filters)` | `server/repositories/order.repository.ts` | Historial de pedidos pagados de un usuario dentro de un rango de fechas `[from, to)`, con líneas agrupadas en memoria. | DB |
| `buildMarkPaid(orderId, paymentIntentId)` / `buildMarkFailed(orderId, paymentIntentId)` | `server/repositories/order.repository.ts` | Arman el cambio de estado del pedido con guarda de idempotencia (`status = 'pending'`), sin ejecutar. | Pura (arma SQL) |
| `listByUserId(userId)` | `server/repositories/payment-method.repository.ts` | Lista las tarjetas guardadas de un usuario, más reciente primero. | DB |
| `upsertByStripeId(data)` | `server/repositories/payment-method.repository.ts` | Alta idempotente de un método de pago por su id de Stripe; no permite cambiar de dueño una tarjeta ya registrada. | DB |
| `findByIdAndUserId(id, userId)` / `deleteById(id)` | `server/repositories/payment-method.repository.ts` | Búsqueda con verificación de propiedad y borrado de una tarjeta. | DB |

---

## 3. Servicios de servidor (`src/server/services`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `syncClerkAccessMetadata(clerkId)` | `server/services/user-access.service.ts` | Recalcula roles/permisos en Postgres y los sincroniza al `publicMetadata` de Clerk. | DB, Clerk |
| `markPendingAccess(clerkId, roleSlugs)` | `server/services/user-access.service.ts` | Marca en Clerk que el usuario tiene roles pendientes y debe cambiar su contraseña temporal. | Clerk |
| `fulfillCheckout(session, context)` | `server/services/order-fulfillment.service.ts` | Marca un pedido como pagado, descuenta stock y audita, todo en un batch; detecta líneas con sobreventa (`findOversoldLines`). Devuelve `fulfilled` / `already_processed` / `order_not_found`. | DB |
| `markOrderFailed(session, context)` | `server/services/order-fulfillment.service.ts` | Marca un pedido como fallido tras un pago asíncrono rechazado, sin tocar stock. | DB |
| `resolveOrderReceiptUrl(userId, orderId)` | `server/services/order-receipt.service.ts` | Resuelve la URL de la boleta de un pedido contra Stripe (`latest_charge.receipt_url`), distinguiendo "no encontrado"/"aún no disponible"/"Stripe caído". | DB, Stripe |
| `toSavedCard(row)` | `server/services/saved-card.service.ts` | Mapea una fila de `payment_methods` al contrato público `SavedCard` (sin ids de Stripe). | Pura |
| `ensureStripeCustomer(actor)` | `server/services/saved-card.service.ts` | Devuelve el Customer de Stripe del usuario, creándolo la primera vez; protege contra condición de carrera. | DB, Stripe |
| `createSetupSession(actor)` | `server/services/saved-card.service.ts` | Crea una Checkout Session en modo `setup` para guardar una tarjeta. | DB, Stripe |
| `savePaymentMethodFromSetupSession(setupSessionId, userId)` | `server/services/saved-card.service.ts` | Confirma una sesión de setup completada y persiste la tarjeta; valida pertenencia contra Stripe. | DB, Stripe |
| `removeSavedCard(userId, cardId)` | `server/services/saved-card.service.ts` | Hace `detach` en Stripe y borra la fila local; tolera que el método ya no exista en Stripe. | DB, Stripe |
| `createCheckoutSession(actor, items, options)` | `server/services/checkout.service.ts` | Revalida precio/stock de cada línea contra la BD (`priceLines`), arma los `line_items` (`toLineItems`), crea la Checkout Session y el pedido `pending`. | DB, Stripe |

---

## 4. Módulo Products (`src/modules/products`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `createProductSchema` / `updateProductSchema` (validación) | `schemas/product.schema.ts` | Validan alta/edición de producto: slug con patrón, SKU normalizado a mayúsculas, precios y stock no negativos y acotados a `int4`, URL de imagen normalizada a `null` si viene vacía. | Pura |
| `getProducts()` / `createProduct(input)` / `updateProduct(id, input)` / `deleteProduct(id)` | `services/product.service.ts` | Llamadas axios tipadas al endpoint `/api/products`. | HTTP |
| `getApiErrorMessage(error, fallback)` | `services/product.service.ts` | Traduce el error uniforme de la API a un mensaje presentable (copia local, ver nota). | Pura |
| `isConflictError(error)` | `services/product.service.ts` | Indica si el error HTTP fue un 409 (conflicto). | Pura |
| `formatPrice(cents)` | `constants.ts` | Formatea centavos como moneda `es-ES`/EUR. | Pura |
| `unitsToCents(units)` / `centsToUnits(cents)` | `constants.ts` | Convierten entre unidades con decimales (formulario) y centavos enteros (BD), con redondeo seguro. | Pura |

---

## 5. Módulo Categories (`src/modules/categories`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `createCategorySchema` / `updateCategorySchema` (validación) | `schemas/category.schema.ts` | Validan alta/edición: nombre y slug con longitud y patrón, `sortOrder` no negativo, rechaza un PATCH sin cambios. | Pura |
| `getCategories()` / `createCategory(input)` / `updateCategory(id, input)` / `deleteCategory(id)` | `services/category.service.ts` | Llamadas axios tipadas al endpoint `/api/categories`. | HTTP |
| `getApiErrorMessage(error, fallback)` / `isConflictError(error)` | `services/category.service.ts` | Igual que en Products, copia local por dominio. | Pura |

---

## 6. Módulo Users (`src/modules/users`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `createUserSchema` / `updateUserSchema` / `assignRolesSchema` (validación) | `schemas/user.schema.ts` | Validan alta, edición y reasignación de roles de usuario. | Pura |
| `getUsers()` / `createUser(input)` / `updateUser(id, input)` / `assignRoles(id, input)` | `services/user.service.ts` | Llamadas axios tipadas al endpoint `/api/admin/users`. | HTTP |
| `getApiErrorMessage(error, fallback)` / `isConflictError(error)` / `isForbiddenError(error)` | `services/user.service.ts` | Traducción de errores de la API, incluida la detección de 403. | Pura |
| `formatDate(value)` | `constants.ts` | Formatea una fecha en `es-ES` (día/mes/año). | Pura |
| `getFullName(user)` | `constants.ts` | Compone "Nombre Apellido" a partir de `firstName`/`lastName`; cae a "Sin nombre" si ambos faltan. | Pura |

---

## 7. Módulo Roles (`src/modules/roles`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `getRoles()` | `services/role.service.ts` | Llamada axios al endpoint `/api/admin/roles`. | HTTP |
| `isPrivilegedRoleSlug(slug)` | `constants.ts` | Ver sección 2.2 (identidad y acceso). | Pura |
| `getPermissionLabel(code)` | `constants/permission-labels.ts` | Ver sección 2.2. | Pura |

---

## 8. Módulo Audit Logs (`src/modules/audit-logs`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `auditLogFiltersSchema` (validación) | `schemas/audit-log.schema.ts` | Valida y acota los filtros de la bitácora (`limit` entre 1 y 200, fechas coercionadas). | Pura |
| `toQueryParams(filters)` | `services/audit-log.service.ts` | Serializa los filtros a query params, omitiendo los vacíos y convirtiendo fechas a ISO. | Pura |
| `getAuditLogs(filters)` | `services/audit-log.service.ts` | Llamada axios al endpoint `/api/admin/audit-logs` con los filtros ya serializados. | HTTP |
| `getApiErrorMessage(error, fallback)` | `services/audit-log.service.ts` | Traducción de errores de la API. | Pura |
| `getAuditActionLabel(action)` | `constants.ts` | Traduce el código de acción de auditoría a lenguaje llano; cae al propio código si es desconocido. | Pura |
| `formatDateTime(value)` | `constants.ts` | Formatea fecha y hora en `es-ES`. | Pura |

---

## 9. Módulo Profile (`src/modules/profile`)

### 9.1 Historial de pedidos

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `orderHistoryQuerySchema` (validación) | `schemas/order-history.schema.ts` | Valida el rango `[from, to)` del historial: `to` posterior a `from` y span máximo de 400 días. | Pura |
| `getOrderHistory(range)` / `getOrderReceipt(orderId)` | `services/order-history.service.ts` | Llamadas axios a `/api/orders` y a la boleta de un pedido. | HTTP |
| `formatOrderTime(isoDate)` | `lib/group-orders-by-day.ts` | Formatea la hora de un pedido (`HH:mm`, `es-ES`). | Pura |
| `groupOrdersByDay(items)` | `lib/group-orders-by-day.ts` | Agrupa el historial de pedidos por día en la zona horaria del usuario (no del servidor), ordenado descendente. | Pura |
| `parseAccountTab(value)` | `constants.ts` | Valida que el parámetro `?tab=` sea una pestaña conocida; cae a `"profile"` por defecto. | Pura |
| `toDateInputValue(date)` | `constants.ts` | Formatea una fecha local como `YYYY-MM-DD` sin pasar por UTC. | Pura |
| `getCurrentMonthRange(now?)` | `constants.ts` | Calcula el rango `[inicio de mes, inicio de mes siguiente)` como instantes ISO. | Pura |
| `getCurrentMonthDateInputs(now?)` | `constants.ts` | Igual que el anterior, pero en formato `YYYY-MM-DD` para prellenar el formulario. | Pura |
| `toRangeFromDateInputs(range)` | `constants.ts` | Convierte un rango de `input[type=date]` a instantes ISO `[from, to)`, sumando un día al `to`; `null` si las fechas están vacías o mal formadas. | Pura |

### 9.2 Tarjetas guardadas

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `confirmSetupSchema` / `savedCardIdSchema` / `setupSessionSchema` (validación) | `schemas/saved-card.schema.ts` | Validan el id de sesión de setup (prefijo `cs_`), el id de tarjeta y que el body de creación de sesión venga vacío. | Pura |
| `getSavedCards()` / `createCardSetupSession()` / `confirmSavedCard(id)` / `deleteSavedCard(id)` | `services/saved-card.service.ts` | Llamadas axios a `/api/profile/payment-methods`. | HTTP |
| `formatCardBrand(brand)` | `constants.ts` | Traduce el código de marca de Stripe a su nombre comercial; cae al propio valor si es desconocida. | Pura |
| `formatCardLabel(card)` | `constants.ts` | Compone la etiqueta `Marca •••• 4242`. | Pura |
| `formatCardExpiry(month, year)` | `constants.ts` | Formatea la caducidad como `MM/AAAA`. | Pura |

### 9.3 Cuenta

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `confirmPasswordChanged()` | `services/profile.service.ts` | Llamada axios que confirma el cambio de contraseña temporal. | HTTP |
| `getApiErrorMessage(error, fallback)` | `services/profile.service.ts` | Traducción de errores de la API (copia local). | Pura |

---

## 10. Módulo Storefront (`src/modules/storefront`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `toStorefrontCategory(row)` | `lib/to-storefront-category.ts` | Mapea una fila de categoría con conteo de productos al contrato público de la tienda. | Pura |
| `toStorefrontProduct(row)` | `lib/to-storefront-product.ts` | Construye la respuesta pública de un producto: URL de imagen saneada (`toSafeImageUrl`), porcentaje de descuento (`toDiscountPercent`), disponibilidad booleana y flag "nuevo" por antigüedad. | Pura |
| `storefrontProductQuerySchema` / `storefrontProductSchema` / `storefrontCategorySchema` / `newsletterEmailSchema` (validación) | `schemas/catalog.schema.ts` | Validan/transforman la query del catálogo (CSV a arrays, coerción y límites de paginación) y los contratos de salida. | Pura |
| `toQueryParams(params)` | `services/catalog.service.ts` | Serializa los filtros del catálogo a query params (listas a CSV, omite vacíos). | Pura |
| `getStorefrontProducts(params)` / `getStorefrontCategories()` | `services/catalog.service.ts` | Llamadas axios a `/api/storefront/products` y `/api/storefront/categories`. | HTTP |

---

## 11. Módulo Checkout (`src/modules/checkout`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `checkoutSessionSchema` (validación) | `schemas/checkout.schema.ts` | Valida las líneas del carrito enviadas al servidor: cantidades, tope de líneas y que no haya productos repetidos. | Pura |
| `createCheckoutSession(input)` | `services/checkout.service.ts` | Llamada axios a `/api/checkout/session` (cliente). | HTTP |

> El servicio de servidor homónimo (`createCheckoutSession` de `server/services/checkout.service.ts`) está documentado en la sección 3.

---

## 12. Módulo Cart (`src/modules/cart`)

| Función | Archivo | Qué hace | Dependencia |
|---|---|---|---|
| `clampQuantity(quantity)` | `store/cart.store.ts` | Acota la cantidad de una línea a un entero entre 1 y 99. | Pura (no exportada; testeable indirectamente vía las acciones del store) |
| `addLine(snapshot, quantity?)` | `store/cart.store.ts` | Añade una línea o suma cantidad a una existente, aplicando el tope de `clampQuantity`. | Pura (acción de store Zustand) |
| `setQuantity(productId, quantity)` | `store/cart.store.ts` | Cambia la cantidad de una línea; la elimina si el valor es menor a 1. | Pura |
| `removeLine(productId)` | `store/cart.store.ts` | Elimina una línea del carrito. | Pura |
| `clear()` | `store/cart.store.ts` | Vacía el carrito. | Pura |
| `selectCartCount(state)` | `store/cart.store.ts` | Selector: total de unidades en el carrito. | Pura |
| `selectCartSubtotalCents(state)` | `store/cart.store.ts` | Selector: subtotal en centavos del carrito. | Pura |

---

## Notas generales

1. **Duplicación deliberada de `getApiErrorMessage`/`isConflictError`**: cada `services/*.service.ts` mantiene su propia copia (CLAUDE.md: cada dominio es autónomo, 002 §7). Si se prueban, conviene un solo set de tests parametrizado por módulo en vez de repetir el caso siete veces.
2. **Funciones "constructoras de SQL" sin ejecutar** (`buildAuditLogInsert`, `buildMarkPaid`, `buildStockDecrement`, `buildReplaceForUser`, etc.) son las más fáciles de cubrir con pruebas unitarias reales: no tocan la red, solo devuelven un objeto de sentencia Drizzle. Se puede inspeccionar su forma (`.toSQL()` o similar) sin conectar a Neon.
3. **Funciones marcadas `DB`/`Stripe`/`Clerk`** requieren mockear el módulo correspondiente (`@/server/db`, `stripe`, `@clerk/nextjs/server`) para aislarlas; son candidatas a pruebas unitarias con mocks, no de integración con servicios reales.
4. Los schemas Zod (`*.schema.ts`) se probaron como validación de entrada: se puede invocar `schema.safeParse(input)` con casos válidos e inválidos sin ninguna dependencia — son de los más baratos de cubrir.
