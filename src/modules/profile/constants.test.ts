import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCardBrand,
  formatCardExpiry,
  formatCardLabel,
  getCurrentMonthDateInputs,
  getCurrentMonthRange,
  parseAccountTab,
  toDateInputValue,
  toRangeFromDateInputs,
} from "@/modules/profile/constants.ts";

test("parseAccountTab() accepts a known tab", () => {
  assert.equal(parseAccountTab("cards"), "cards");
});

test("parseAccountTab() falls back to profile for an unknown value", () => {
  assert.equal(parseAccountTab("settings"), "profile");
});

test("parseAccountTab() falls back to profile for undefined", () => {
  assert.equal(parseAccountTab(undefined), "profile");
});

test("formatCardBrand() translates a known Stripe brand", () => {
  assert.equal(formatCardBrand("visa"), "Visa");
});

test("formatCardBrand() falls back to the raw value for an unknown brand", () => {
  assert.equal(formatCardBrand("some_new_network"), "some_new_network");
});

test("formatCardLabel() composes the brand and last 4 digits", () => {
  assert.equal(formatCardLabel({ brand: "mastercard", last4: "4242" }), "Mastercard •••• 4242");
});

test("formatCardExpiry() pads a single-digit month", () => {
  assert.equal(formatCardExpiry(3, 2030), "03/2030");
});

test("formatCardExpiry() doesn't pad a two-digit month", () => {
  assert.equal(formatCardExpiry(12, 2030), "12/2030");
});

test("toDateInputValue() formats a local date as YYYY-MM-DD with zero-padding", () => {
  assert.equal(toDateInputValue(new Date(2026, 0, 5)), "2026-01-05");
});

test("getCurrentMonthRange() spans from the 1st of the month to the 1st of the next", () => {
  const now = new Date(2026, 2, 15);
  const result = getCurrentMonthRange(now);

  assert.equal(result.from, new Date(2026, 2, 1).toISOString());
  assert.equal(result.to, new Date(2026, 3, 1).toISOString());
});

test("getCurrentMonthRange() rolls over into January of the next year", () => {
  const now = new Date(2026, 11, 15);
  const result = getCurrentMonthRange(now);

  assert.equal(result.to, new Date(2027, 0, 1).toISOString());
});

test("getCurrentMonthDateInputs() returns the 1st of the month and today as date inputs", () => {
  const now = new Date(2026, 2, 15);
  assert.deepEqual(getCurrentMonthDateInputs(now), { from: "2026-03-01", to: "2026-03-15" });
});

test("toRangeFromDateInputs() shifts the end date to the start of the next day", () => {
  const result = toRangeFromDateInputs({ from: "2026-01-05", to: "2026-01-10" });

  assert.deepEqual(result, {
    from: new Date(2026, 0, 5).toISOString(),
    to: new Date(2026, 0, 11).toISOString(),
  });
});

test("toRangeFromDateInputs() returns null when a date is empty", () => {
  assert.equal(toRangeFromDateInputs({ from: "", to: "2026-01-10" }), null);
});

test("toRangeFromDateInputs() returns null for a malformed date", () => {
  assert.equal(toRangeFromDateInputs({ from: "05/01/2026", to: "2026-01-10" }), null);
});
