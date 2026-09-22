import { config } from "dotenv";

// `tsx` corre fuera de Next, que es quien normalmente carga `.env.local`.
config({ path: [".env.local", ".env"] });

// Imports de tipo: se borran en compilación, así el script no arrastra el
// runtime de `lib/permissions` (marcado `server-only`) ni el de los módulos.
import type { PermissionCode } from "@/lib/permissions";
import type { RoleSlug } from "@/modules/roles/constants";

/**
 * Catálogo declarativo del RBAC (003 §5.1). Los `Record` están tipados por el
 * union de códigos y de slugs: si el código añade un permiso o un rol y no lo
 * siembra aquí, falla `npm run typecheck`, no la ejecución.
 */
const PERMISSION_CATALOG: Record<
  PermissionCode,
  { resource: string; action: string; description: string }
> = {
  "dashboard.view": {
    resource: "dashboard",
    action: "view",
    description: "Ver el panel de administración",
  },

  "products.view": {
    resource: "products",
    action: "view",
    description: "Ver el catálogo de productos",
  },
  "products.create": {
    resource: "products",
    action: "create",
    description: "Crear productos",
  },
  "products.update": {
    resource: "products",
    action: "update",
    description: "Editar productos",
  },
  "products.delete": {
    resource: "products",
    action: "delete",
    description: "Eliminar productos",
  },

  "categories.view": {
    resource: "categories",
    action: "view",
    description: "Ver las categorías",
  },
  "categories.create": {
    resource: "categories",
    action: "create",
    description: "Crear categorías",
  },
  "categories.update": {
    resource: "categories",
    action: "update",
    description: "Editar categorías",
  },
  "categories.delete": {
    resource: "categories",
    action: "delete",
    description: "Eliminar categorías",
  },

  "users.view": {
    resource: "users",
    action: "view",
    description: "Ver los usuarios de la aplicación",
  },
  "users.create": {
    resource: "users",
    action: "create",
    description: "Dar de alta usuarios",
  },
  "users.update": {
    resource: "users",
    action: "update",
    description: "Editar los datos de un usuario",
  },
  "users.deactivate": {
    resource: "users",
    action: "deactivate",
    description: "Activar y desactivar usuarios",
  },
  "users.assign_roles": {
    resource: "users",
    action: "assign_roles",
    description: "Asignar roles a los usuarios",
  },

  "orders.view": {
    resource: "orders",
    action: "view",
    description: "Ver los pedidos y su detalle",
  },

  "roles.view": {
    resource: "roles",
    action: "view",
    description: "Ver el catálogo de roles y sus permisos",
  },

  "audit_logs.view": {
    resource: "audit_logs",
    action: "view",
    description: "Consultar la bitácora de auditoría",
  },

  "finance.view": {
    resource: "finance",
    action: "view",
    description: "Consultar ingresos, egresos y márgenes",
  },
  "finance.manage": {
    resource: "finance",
    action: "manage",
    description: "Editar costos de producto y la configuración de Finanzas",
  },
};

const ROLE_CATALOG: Record<RoleSlug, { name: string; description: string }> = {
  super_admin: {
    name: "Superadministrador",
    description:
      "Control total del panel: catálogo, usuarios, roles y auditoría.",
  },
  admin: {
    name: "Administrador",
    description:
      "Gestiona el catálogo y los usuarios. No puede desactivar usuarios ni conceder roles de administración.",
  },
  manager: {
    name: "Gestor",
    description:
      "Consulta el panel y actualiza productos. No crea ni elimina, y solo ve la lista de usuarios.",
  },
  employee: {
    name: "Empleado",
    description:
      "Cuenta interna sin acceso al panel de administración. Solo su perfil.",
  },
  customer: {
    name: "Cliente",
    description:
      "Cuenta de tienda. Sin acceso al panel de administración: solo su perfil.",
  },
  audit: {
    name: "Auditoría",
    description:
      "Acceso de solo lectura a la bitácora de auditoría. Nada más del panel.",
  },
};

const ALL_PERMISSION_CODES = Object.keys(PERMISSION_CATALOG) as PermissionCode[];

/** Matriz rol → permisos de 003 §5.1. `employee` y `customer` no tienen ninguno. */
const ROLE_PERMISSION_MATRIX: Record<RoleSlug, readonly PermissionCode[]> = {
  super_admin: ALL_PERMISSION_CODES,
  admin: [
    "dashboard.view",
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "categories.view",
    "categories.create",
    "categories.update",
    "categories.delete",
    "users.view",
    "users.create",
    "users.update",
    "users.assign_roles",
    "orders.view",
    "roles.view",
    "audit_logs.view",
    "finance.view",
    "finance.manage",
  ],
  // `manager` ve Finanzas pero no la edita, igual que ve el catálogo sin poder
  // crear ni eliminar productos (014 §Notas).
  manager: [
    "dashboard.view",
    "products.view",
    "products.update",
    "categories.view",
    "users.view",
    "orders.view",
    "finance.view",
  ],
  audit: ["audit_logs.view"],
  employee: [],
  customer: [],
};

/**
 * Catálogo de demostración (004 §5). Los precios van en centavos y las imágenes
 * apuntan al único host declarado en `next.config.ts`.
 */
const CATEGORY_CATALOG = [
  {
    slug: "portatiles",
    name: "Portátiles",
    description: "Ultraligeros, estaciones de trabajo y equipos para jugar.",
    sortOrder: 1,
  },
  {
    slug: "componentes",
    name: "Componentes",
    description: "Tarjetas gráficas, memoria y almacenamiento.",
    sortOrder: 2,
  },
  {
    slug: "perifericos",
    name: "Periféricos",
    description: "Teclados, ratones y monitores.",
    sortOrder: 3,
  },
  {
    slug: "audio",
    name: "Audio",
    description: "Auriculares y altavoces con y sin cable.",
    sortOrder: 4,
  },
  {
    slug: "moviles",
    name: "Móviles",
    description: "Smartphones y accesorios de carga.",
    sortOrder: 5,
  },
] as const;

type DemoCategorySlug = (typeof CATEGORY_CATALOG)[number]["slug"];

type DemoProduct = {
  name: string;
  slug: string;
  sku: string;
  brand: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  categorySlug: DemoCategorySlug;
  imageUrl: string;
};

const UNSPLASH = "https://images.unsplash.com";

const PRODUCT_CATALOG: DemoProduct[] = [
  {
    name: "Aeris Book 14 Ultraligero",
    slug: "aeris-book-14-ultraligero",
    sku: "LAP-AER-14",
    brand: "Aeris",
    description:
      "1,1 kg, pantalla OLED de 14 pulgadas y 18 horas de autonomía real.",
    priceCents: 129900,
    compareAtPriceCents: 154900,
    stock: 24,
    categorySlug: "portatiles",
    imageUrl: `${UNSPLASH}/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Aeris Book 16 Pro",
    slug: "aeris-book-16-pro",
    sku: "LAP-AER-16",
    brand: "Aeris",
    description:
      "Estación de trabajo con 32 GB de memoria unificada y lector de tarjetas.",
    priceCents: 219900,
    compareAtPriceCents: null,
    stock: 11,
    categorySlug: "portatiles",
    imageUrl: `${UNSPLASH}/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Volt Raider 15 Gaming",
    slug: "volt-raider-15-gaming",
    sku: "LAP-VLT-15",
    brand: "Volt",
    description: "Panel de 165 Hz, refrigeración por cámara de vapor y RGB por tecla.",
    priceCents: 174900,
    compareAtPriceCents: 199900,
    stock: 7,
    categorySlug: "portatiles",
    imageUrl: `${UNSPLASH}/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Nimbus Air 13 Estudiante",
    slug: "nimbus-air-13-estudiante",
    sku: "LAP-NMB-13",
    brand: "Nimbus",
    description: "El portátil de diario: silencioso, sin ventiladores y con USB-C.",
    priceCents: 74900,
    compareAtPriceCents: null,
    stock: 0,
    categorySlug: "portatiles",
    imageUrl: `${UNSPLASH}/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Vertex RX 8800 16 GB",
    slug: "vertex-rx-8800-16gb",
    sku: "GPU-VTX-8800",
    brand: "Vertex",
    description: "Gráfica de 16 GB para 1440p a alta tasa de refresco.",
    priceCents: 89900,
    compareAtPriceCents: 109900,
    stock: 15,
    categorySlug: "componentes",
    imageUrl: `${UNSPLASH}/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Kernel DDR5 32 GB 6000 MHz",
    slug: "kernel-ddr5-32gb-6000",
    sku: "RAM-KRN-32",
    brand: "Kernel",
    description: "Kit de dos módulos con perfil bajo y disipador de aluminio.",
    priceCents: 12900,
    compareAtPriceCents: 15900,
    stock: 60,
    categorySlug: "componentes",
    imageUrl: `${UNSPLASH}/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Kernel SSD NVMe 2 TB",
    slug: "kernel-ssd-nvme-2tb",
    sku: "SSD-KRN-2T",
    brand: "Kernel",
    description: "Lecturas de 7.400 MB/s y disipador incluido.",
    priceCents: 15900,
    compareAtPriceCents: null,
    stock: 42,
    categorySlug: "componentes",
    imageUrl: `${UNSPLASH}/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Fuente Volt Silent 850 W Gold",
    slug: "volt-silent-850w-gold",
    sku: "PSU-VLT-850",
    brand: "Volt",
    description: "Modular, certificación 80 Plus Gold y ventilador que se detiene en reposo.",
    priceCents: 11900,
    compareAtPriceCents: 13900,
    stock: 33,
    categorySlug: "componentes",
    imageUrl: `${UNSPLASH}/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Klick Teclado Mecánico 75%",
    slug: "klick-teclado-mecanico-75",
    sku: "KEY-KLK-75",
    brand: "Klick",
    description: "Switches lineales, hot-swap y conexión inalámbrica de baja latencia.",
    priceCents: 10900,
    compareAtPriceCents: 13900,
    stock: 48,
    categorySlug: "perifericos",
    imageUrl: `${UNSPLASH}/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Klick Ratón Ligero 58 g",
    slug: "klick-raton-ligero-58g",
    sku: "MOU-KLK-58",
    brand: "Klick",
    description: "Sensor de 26.000 ppp y 90 horas de batería.",
    priceCents: 6900,
    compareAtPriceCents: null,
    stock: 75,
    categorySlug: "perifericos",
    imageUrl: `${UNSPLASH}/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Lumen Monitor 27\" 4K",
    slug: "lumen-monitor-27-4k",
    sku: "MON-LUM-27",
    brand: "Lumen",
    description: "IPS de 27 pulgadas, 144 Hz y USB-C con 90 W de carga.",
    priceCents: 54900,
    compareAtPriceCents: 64900,
    stock: 18,
    categorySlug: "perifericos",
    imageUrl: `${UNSPLASH}/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Lumen Webcam 4K con IA",
    slug: "lumen-webcam-4k-ia",
    sku: "CAM-LUM-4K",
    brand: "Lumen",
    description: "Encuadre automático, corrección de luz y micrófono doble.",
    priceCents: 13900,
    compareAtPriceCents: null,
    stock: 27,
    categorySlug: "perifericos",
    imageUrl: `${UNSPLASH}/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Echo Studio ANC Auriculares",
    slug: "echo-studio-anc-auriculares",
    sku: "AUD-ECH-ANC",
    brand: "Echo",
    description: "Cancelación activa adaptativa y 40 horas de reproducción.",
    priceCents: 24900,
    compareAtPriceCents: 32900,
    stock: 36,
    categorySlug: "audio",
    imageUrl: `${UNSPLASH}/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Echo Buds Pro",
    slug: "echo-buds-pro",
    sku: "AUD-ECH-BUD",
    brand: "Echo",
    description: "Auriculares de botón con audio espacial y estuche de carga sin cables.",
    priceCents: 14900,
    compareAtPriceCents: 17900,
    stock: 54,
    categorySlug: "audio",
    imageUrl: `${UNSPLASH}/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Echo Altavoz Portátil 360",
    slug: "echo-altavoz-portatil-360",
    sku: "AUD-ECH-360",
    brand: "Echo",
    description: "Sonido envolvente, resistencia IP67 y 20 horas de batería.",
    priceCents: 8900,
    compareAtPriceCents: null,
    stock: 40,
    categorySlug: "audio",
    imageUrl: `${UNSPLASH}/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Orbit One 5G 256 GB",
    slug: "orbit-one-5g-256gb",
    sku: "PHO-ORB-256",
    brand: "Orbit",
    description: "Pantalla de 6,7 pulgadas a 120 Hz y triple cámara estabilizada.",
    priceCents: 84900,
    compareAtPriceCents: 99900,
    stock: 21,
    categorySlug: "moviles",
    imageUrl: `${UNSPLASH}/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80`,
  },
  {
    name: "Orbit Cargador GaN 100 W",
    slug: "orbit-cargador-gan-100w",
    sku: "PHO-ORB-GAN",
    brand: "Orbit",
    description: "Tres puertos, tamaño de bolsillo y carga un portátil completo.",
    priceCents: 5900,
    compareAtPriceCents: 7900,
    stock: 90,
    categorySlug: "moviles",
    imageUrl: `${UNSPLASH}/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80`,
  },
];

async function seedCatalog(): Promise<void> {
  const { db } = await import("./index");
  const { category } = await import("./schema/category");
  const { product } = await import("./schema/product");

  await db
    .insert(category)
    .values(CATEGORY_CATALOG.map((item) => ({ ...item })))
    .onConflictDoNothing({ target: category.slug });

  const categories = await db
    .select({ id: category.id, slug: category.slug })
    .from(category);
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  // El catálogo demo no se reinyecta sobre una tienda que ya tiene productos:
  // sobrescribiría precios y stock reales del admin. Los únicos de `products`
  // son parciales (`where deleted_at is null`) y no sirven como destino de
  // `on conflict`, así que la idempotencia se resuelve con esta comprobación.
  const [existingProduct] = await db
    .select({ id: product.id })
    .from(product)
    .limit(1);

  if (existingProduct) {
    console.info(
      "Seed de catálogo omitido: ya hay productos en la base de datos.",
    );

    return;
  }

  const productValues = PRODUCT_CATALOG.map((item) => {
    const categoryId = categoryIdBySlug.get(item.categorySlug);

    if (!categoryId) {
      throw new Error(
        `La categoría "${item.categorySlug}" no se sembró correctamente`,
      );
    }

    return {
      name: item.name,
      slug: item.slug,
      sku: item.sku,
      description: item.description,
      brand: item.brand,
      priceCents: item.priceCents,
      compareAtPriceCents: item.compareAtPriceCents,
      stock: item.stock,
      categoryId,
      imageUrl: item.imageUrl,
      isActive: true,
    };
  });

  await db.insert(product).values(productValues);

  console.info(
    `Seed de catálogo completado: ${CATEGORY_CATALOG.length} categorías y ${productValues.length} productos.`,
  );
}

async function seed(): Promise<void> {
  // Import diferido: `db` lee `DATABASE_URL` al evaluarse, así que no puede
  // cargarse antes de que `dotenv` haya poblado el entorno.
  const { db } = await import("./index");
  const { permission } = await import("./schema/permission");
  const { role } = await import("./schema/role");
  const { rolePermission } = await import("./schema/role-permission");

  const permissionValues = ALL_PERMISSION_CODES.map((code) => ({
    code,
    ...PERMISSION_CATALOG[code],
  }));

  const roleValues = (Object.keys(ROLE_CATALOG) as RoleSlug[]).map((slug) => ({
    slug,
    ...ROLE_CATALOG[slug],
    isSystem: true,
  }));

  // `onConflictDoNothing` sobre los únicos (`code`, `slug`) hace el seed
  // reejecutable: la segunda pasada no falla ni duplica.
  await db.insert(permission).values(permissionValues).onConflictDoNothing({
    target: permission.code,
  });
  await db.insert(role).values(roleValues).onConflictDoNothing({
    target: role.slug,
  });

  // Los ids se releen porque `onConflictDoNothing` no devuelve las filas ya
  // existentes: en la segunda pasada `returning()` vendría vacío.
  const permissions = await db
    .select({ id: permission.id, code: permission.code })
    .from(permission);
  const roles = await db.select({ id: role.id, slug: role.slug }).from(role);

  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));
  const roleIdBySlug = new Map(roles.map((r) => [r.slug, r.id]));

  const rolePermissionValues = (
    Object.keys(ROLE_PERMISSION_MATRIX) as RoleSlug[]
  ).flatMap((slug) => {
    const roleId = roleIdBySlug.get(slug);

    if (!roleId) {
      throw new Error(`El rol "${slug}" no se sembró correctamente`);
    }

    return ROLE_PERMISSION_MATRIX[slug].map((code) => {
      const permissionId = permissionIdByCode.get(code);

      if (!permissionId) {
        throw new Error(`El permiso "${code}" no se sembró correctamente`);
      }

      return { roleId, permissionId };
    });
  });

  if (rolePermissionValues.length > 0) {
    await db
      .insert(rolePermission)
      .values(rolePermissionValues)
      .onConflictDoNothing();
  }

  console.info(
    `Seed RBAC completado: ${permissionValues.length} permisos, ${roleValues.length} roles, ${rolePermissionValues.length} asignaciones rol → permiso.`,
  );

  await seedCatalog();
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Fallo el seed", error);
    process.exit(1);
  });
