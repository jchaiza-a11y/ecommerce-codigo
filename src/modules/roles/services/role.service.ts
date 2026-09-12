import { api } from "@/lib/axios";
import type { RoleWithPermissions } from "@/modules/roles/types/role.types";

const RESOURCE = "/api/admin/roles";

export async function getRoles(): Promise<RoleWithPermissions[]> {
  const { data } = await api.get<RoleWithPermissions[]>(RESOURCE);

  return data;
}
