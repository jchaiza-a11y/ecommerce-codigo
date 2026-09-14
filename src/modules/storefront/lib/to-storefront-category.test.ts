import test from "node:test";
import assert from "node:assert/strict";

import { toStorefrontCategory } from "@/modules/storefront/lib/to-storefront-category.ts";

test("toStorefrontCategory() keeps only the public fields", () => {
  assert.deepEqual(
    toStorefrontCategory({
      id: "cat_1",
      name: "Laptops",
      slug: "laptops",
      productCount: 5,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never),
    { id: "cat_1", name: "Laptops", slug: "laptops", productCount: 5 },
  );
});
