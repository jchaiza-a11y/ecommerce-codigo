import test from "node:test";
import assert from "node:assert/strict";

import { isOptimizableImageUrl } from "@/lib/image.ts";

test("null counts as optimizable (falls back to local placeholder)", () => {
  assert.equal(isOptimizableImageUrl(null), true);
});

test("empty string counts as optimizable", () => {
  assert.equal(isOptimizableImageUrl(""), true);
});

test("URL on the allow-listed host is optimizable", () => {
  assert.equal(
    isOptimizableImageUrl("https://images.unsplash.com/photo-123"),
    true,
  );
});

test("URL on a host outside the allow-list is not optimizable", () => {
  assert.equal(
    isOptimizableImageUrl("https://cdn.example.com/photo.jpg"),
    false,
  );
});

test("malformed URL counts as optimizable", () => {
  assert.equal(isOptimizableImageUrl("not-a-url"), true);
});
