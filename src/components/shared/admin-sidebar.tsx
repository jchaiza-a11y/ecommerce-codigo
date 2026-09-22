"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

import type { PermissionCode } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Sin permiso declarado el ítem se muestra siempre. */
  requiredPermission?: PermissionCode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    requiredPermission: "dashboard.view",
  },
  {
    href: "/admin/products",
    label: "Productos",
    icon: Package,
    requiredPermission: "products.view",
  },
  {
    href: "/admin/categories",
    label: "Categorías",
    icon: Tags,
    requiredPermission: "categories.view",
  },
  // Pedidos y Clientes siguen sin página real, así que no tienen permiso propio
  // que comprobar (003 §3, fuera de alcance).
  { href: "/admin/orders", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/customers", label: "Clientes", icon: UsersRound },
  {
    href: "/admin/users",
    label: "Usuarios",
    icon: Users,
    requiredPermission: "users.view",
  },
  {
    href: "/admin/roles",
    label: "Roles",
    icon: ShieldCheck,
    requiredPermission: "roles.view",
  },
  {
    href: "/admin/finance",
    label: "Finanzas",
    icon: Wallet,
    requiredPermission: "finance.view",
  },
  {
    href: "/admin/audit-logs",
    label: "Auditoría",
    icon: ScrollText,
    requiredPermission: "audit_logs.view",
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type AdminSidebarProps = {
  /** Permisos efectivos resueltos en el layout contra Postgres. */
  permissions: readonly PermissionCode[];
};

export function AdminSidebar({ permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) =>
      !item.requiredPermission || permissions.includes(item.requiredPermission),
  );

  return (
    <aside className="w-64 shrink-0 border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="text-base font-semibold">
          Administración
        </Link>
      </div>

      <nav aria-label="Navegación de administración" className="p-3">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isItemActive(pathname, href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
