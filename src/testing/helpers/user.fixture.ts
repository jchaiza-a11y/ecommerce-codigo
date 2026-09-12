import type { CurrentUser } from "@/lib/auth";

/**
 * Builder de un `CurrentUser` de prueba (permisos, roles, `isActive`) para
 * tests de `can()`, `requirePermission()` y similares, sin pegarle a
 * Postgres ni a Clerk.
 */
export function buildCurrentUser(
  overrides: Partial<CurrentUser> = {},
): CurrentUser {
  return {
    id: "user_test",
    clerkId: "clerk_test",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    isActive: true,
    roles: [],
    permissions: [],
    ...overrides,
  };
}
