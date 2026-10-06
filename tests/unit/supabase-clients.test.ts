import type { CookieMethodsServer } from "@supabase/ssr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const mocks = vi.hoisted(() => ({
  browser: vi.fn<(...args: unknown[]) => unknown>(),
  server: vi.fn<(...args: unknown[]) => unknown>(),
  admin: vi.fn<(...args: unknown[]) => unknown>(),
  cookieStore: {
    getAll: vi.fn(() => [{ name: "unit-cookie", value: "opaque-unit-value" }]),
    set: vi.fn<(...args: unknown[]) => void>(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.browser,
  createServerClient: mocks.server,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.admin }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));

const publicKey = ["sb", "publishable", "unit", "only"].join("_");
const secretKey = ["sb", "secret", "unit", "only"].join("_");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://unit-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publicKey);
  vi.stubEnv("SUPABASE_SECRET_KEY", secretKey);
});

describe("Supabase factory isolation", () => {
  it("gives the browser only the public credentials", () => {
    createBrowserSupabaseClient();
    expect(mocks.browser).toHaveBeenCalledWith(
      "https://unit-test.supabase.co",
      publicKey,
    );
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("constructs a fresh user-context server client with cookies and cache headers", async () => {
    const responseHeaders = new Headers();
    await createServerSupabaseClient(responseHeaders);
    await createServerSupabaseClient(new Headers());
    expect(mocks.server).toHaveBeenCalledTimes(2);
    const [url, key, rawOptions] = mocks.server.mock.calls[0] ?? [];
    expect(url).toBe("https://unit-test.supabase.co");
    expect(key).toBe(publicKey);
    const options = rawOptions as { cookies: CookieMethodsServer };
    expect(options.cookies.getAll()).toEqual(mocks.cookieStore.getAll());
    await options.cookies.setAll?.(
      [
        {
          name: "unit-cookie",
          value: "new-opaque-value",
          options: { path: "/" },
        },
      ],
      {
        "Cache-Control": "private, no-store",
        Expires: "0",
        Pragma: "no-cache",
      },
    );
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      "unit-cookie",
      "new-opaque-value",
      { path: "/" },
    );
    expect(responseHeaders.get("Cache-Control")).toBe("private, no-store");
    expect(responseHeaders.get("Expires")).toBe("0");
    expect(responseHeaders.get("Pragma")).toBe("no-cache");
  });

  it("does not swallow a failed server cookie write", async () => {
    await createServerSupabaseClient(new Headers());
    const options = mocks.server.mock.calls[0]?.[2] as {
      cookies: CookieMethodsServer;
    };
    mocks.cookieStore.set.mockImplementationOnce(() => {
      throw new Error("Cookie storage is read-only");
    });
    expect(() =>
      options.cookies.setAll?.(
        [{ name: "unit-cookie", value: "opaque-value", options: {} }],
        {},
      ),
    ).toThrow("Cookie storage is read-only");
  });

  it("keeps privileged auth stateless and all server requests uncached", async () => {
    createAdminSupabaseClient();
    const [url, key, rawOptions] = mocks.admin.mock.calls[0] ?? [];
    expect(url).toBe("https://unit-test.supabase.co");
    expect(key).toBe(secretKey);
    const options = rawOptions as {
      auth: Record<string, boolean>;
      global: { fetch: typeof fetch };
    };
    expect(options.auth).toEqual({
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    await options.global.fetch("https://unit-test.supabase.co", {
      method: "GET",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://unit-test.supabase.co", {
      method: "GET",
      cache: "no-store",
    });
    await createServerSupabaseClient(new Headers());
    const serverOptions = mocks.server.mock.calls[0]?.[2] as {
      global: { fetch: typeof fetch };
    };
    await serverOptions.global.fetch("https://unit-test.supabase.co");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://unit-test.supabase.co",
      {
        cache: "no-store",
      },
    );
  });
});
