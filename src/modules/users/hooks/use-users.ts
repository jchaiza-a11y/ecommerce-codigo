"use client";

import { useQuery } from "@tanstack/react-query";

import { userKeys } from "@/modules/users/constants";
import { getUsers } from "@/modules/users/services/user.service";

export function useUsers() {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: getUsers,
  });
}
