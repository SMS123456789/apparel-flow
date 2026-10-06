import type { CookieMethodsServer } from "@supabase/ssr";
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
const mocks = vi.hoisted(() => ({ server: vi.fn(), claims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.server }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://unit-test.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ["sb", "publishable", "unit", "only"].join("_"),
  );
  mocks.server.mockReturnValue({ auth: { getClaims: mocks.claims } });
  mocks.claims.mockResolvedValue({ data: null });
});
it("redirects unauthenticated protected browser navigation", async () => {
  const response = await proxy(new NextRequest("https://unit.test/verifier"));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://unit.test/login");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("leaves APIs to their independent JSON authentication guards", async () => {
  const response = await proxy(
    new NextRequest("https://unit.test/api/admin/users"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
});
it("does not use token role claims to authorize a workspace", async () => {
  mocks.claims.mockResolvedValue({
    data: { claims: { sub: "unit-subject", role: "authenticated" } },
  });
  const response = await proxy(new NextRequest("https://unit.test/admin"));
  expect(response.status).toBe(200);
  expect(mocks.claims).toHaveBeenCalledOnce();
});
it("propagates refreshed request cookies, response cookies and cache headers even on a redirect", async () => {
  const request = new NextRequest("https://unit.test/admin");
  mocks.server.mockImplementation(
    (
      _url: unknown,
      _key: unknown,
      options: { cookies: CookieMethodsServer },
    ) => ({
      auth: {
        getClaims: async () => {
          await options.cookies.setAll?.(
            [
              {
                name: "unit-refreshed",
                value: "opaque-unit-cookie",
                options: {
                  path: "/",
                  httpOnly: true,
                  secure: true,
                  sameSite: "lax",
                },
              },
            ],
            {
              "Cache-Control": "private, no-store",
              Expires: "0",
              Pragma: "no-cache",
            },
          );
          return { data: null };
        },
      },
    }),
  );
  const response = await proxy(request);
  expect(request.cookies.get("unit-refreshed")?.value).toBe(
    "opaque-unit-cookie",
  );
  expect(response.cookies.get("unit-refreshed")).toMatchObject({
    value: "opaque-unit-cookie",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  expect(response.headers.get("expires")).toBe("0");
});
