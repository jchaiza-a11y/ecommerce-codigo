"use client";

import { useQuery } from "@tanstack/react-query";

import { roleKeys } from "@/modules/roles/constants";
import { getRoles } from "@/modules/roles/services/role.service";

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.lists(),
    queryFn: getRoles,
  });
}
