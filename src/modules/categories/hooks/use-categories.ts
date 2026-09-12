"use client";

import { useQuery } from "@tanstack/react-query";

import { categoryKeys } from "@/modules/categories/constants";
import { getCategories } from "@/modules/categories/services/category.service";

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: getCategories,
  });
}
