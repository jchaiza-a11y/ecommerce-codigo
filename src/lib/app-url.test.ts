import test from "node:test";
import assert from "node:assert/strict";

import { getAppUrl } from "@/lib/app-url.ts";

const ENV_KEY = "NEXT_PUBLIC_APP_URL";

function withEnv(value: string | undefined, run: () => void) {
  const original = process.env[ENV_KEY];
  if (value === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = value;
  }

  try {
    run();
  } finally {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  }
}

test("returns the configured URL unchanged", () => {
  withEnv("https://tienda.example.com", () => {
    assert.equal(getAppUrl(), "https://tienda.example.com");
  });
});

test("strips a single trailing slash", () => {
  withEnv("https://tienda.example.com/", () => {
    assert.equal(getAppUrl(), "https://tienda.example.com");
  });
});

test("throws when the env var is missing", () => {
  withEnv(undefined, () => {
    assert.throws(() => getAppUrl(), /NEXT_PUBLIC_APP_URL/);
  });
});

test("throws when the env var is an empty string", () => {
  withEnv("", () => {
    assert.throws(() => getAppUrl(), /NEXT_PUBLIC_APP_URL/);
  });
});
