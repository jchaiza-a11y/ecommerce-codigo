"use client";

import { useQuery } from "@tanstack/react-query";

import { productKeys } from "@/modules/products/constants";
import { getProducts } from "@/modules/products/services/product.service";

export function useProducts() {
  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: getProducts,
  });
}
