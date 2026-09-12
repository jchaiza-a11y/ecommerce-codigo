import test from "node:test";
import assert from "node:assert/strict";

import { cn } from "@/lib/utils.ts";

test("joins multiple plain class strings", () => {
  assert.equal(cn("a", "b", "c"), "a b c");
});

test("drops falsy conditional inputs", () => {
  assert.equal(cn("a", false, undefined, null, "b"), "a b");
});

test("returns empty string for no input", () => {
  assert.equal(cn(), "");
});

test("last conflicting Tailwind utility wins", () => {
  assert.equal(cn("p-2", "p-4"), "p-4");
});

test("merges non-conflicting utilities without dropping either", () => {
  assert.equal(cn("text-sm", "font-bold"), "text-sm font-bold");
});
