import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database.generated";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const client = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (updated, cacheHeaders) => {
          updated.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          updated.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(cacheHeaders).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    },
  );
  // Signature validation/refresh only. Controllers independently validate Auth + profile.
  const { data } = await client.auth.getClaims();
  const protectedPage = ["/admin", "/supervisor", "/verifier", "/sewing"].some(
    (path) =>
      request.nextUrl.pathname === path ||
      request.nextUrl.pathname.startsWith(`${path}/`),
  );
  if (!data?.claims && protectedPage) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    const redirected = NextResponse.redirect(destination);
    response.cookies
      .getAll()
      .forEach((cookie) => redirected.cookies.set(cookie));
    for (const name of ["Cache-Control", "Pragma", "Expires"]) {
      const value = response.headers.get(name);
      if (value) redirected.headers.set(name, value);
    }
    response = redirected;
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
export const config = {
  matcher: [
    "/login",
    "/admin/:path*",
    "/supervisor/:path*",
    "/verifier/:path*",
    "/sewing/:path*",
    "/api/:path*",
  ],
};
