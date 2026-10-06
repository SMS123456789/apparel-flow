import { describe, expect, it, vi } from "vitest";

import { parsePublicEnv } from "@/lib/env/public";
import { parseServerEnv } from "@/lib/env/server";

// Vitest executes trusted server modules in Node, not the Next.js bundler.
// The actual server-only import rejection is separately verified with Next.js.
vi.mock("server-only", () => ({}));

const publicKey = ["sb", "publishable", "unit", "only"].join("_");
const secretKey = ["sb", "secret", "unit", "only"].join("_");
const publicConfig = {
  NEXT_PUBLIC_SUPABASE_URL: "https://unit-test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
};

function legacyApiKey(role: string) {
  return `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ role }))}.unsigned-unit-fixture`;
}

describe("public environment boundary", () => {
  it("returns only the public configuration even when input contains secrets", () => {
    const config = parsePublicEnv({
      ...publicConfig,
      SUPABASE_SECRET_KEY: secretKey,
    });
    expect(config).toEqual(publicConfig);
    expect(Object.values(config)).not.toContain(secretKey);
  });

  it.each([secretKey, legacyApiKey("service_role")])(
    "rejects privileged credentials in the public-key field",
    (key) => {
      expect(() =>
        parsePublicEnv({
          ...publicConfig,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      ).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    },
  );

  it("supports a legacy anon API key without granting user identity", () => {
    const key = legacyApiKey("anon");
    expect(
      parsePublicEnv({
        ...publicConfig,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ).toBe(key);
  });

  it("reports missing fields by name", () => {
    expect(() => parsePublicEnv({})).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(() => parsePublicEnv({})).toThrow(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("does not echo invalid configuration values", () => {
    const value = "invalid-private-value-that-must-not-be-logged";
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: value,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value,
      }),
    ).toThrow(
      "Missing or invalid environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it.each(["http://127.0.0.1:54321", "http://localhost:54321"])(
    "allows HTTP only for loopback development",
    (url) => {
      expect(
        parsePublicEnv({ ...publicConfig, NEXT_PUBLIC_SUPABASE_URL: url }),
      ).toBeDefined();
    },
  );

  it.each([
    "http://remote.example.com",
    "https://user:password@example.com",
    "https://example.com?token=private",
    "https://example.com#private",
  ])("rejects unsafe project URLs", (url) => {
    expect(() =>
      parsePublicEnv({ ...publicConfig, NEXT_PUBLIC_SUPABASE_URL: url }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});

describe("privileged environment boundary", () => {
  it.each([secretKey, legacyApiKey("service_role")])(
    "accepts modern and legacy privileged API-key formats",
    (key) => {
      expect(parseServerEnv({ SUPABASE_SECRET_KEY: key })).toEqual({
        SUPABASE_SECRET_KEY: key,
      });
    },
  );

  it.each([publicKey, legacyApiKey("anon"), "placeholder", undefined])(
    "rejects missing or inappropriate keys without echoing them",
    (key) => {
      expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: key })).toThrow(
        "Missing or invalid environment variable: SUPABASE_SECRET_KEY",
      );
    },
  );
});
