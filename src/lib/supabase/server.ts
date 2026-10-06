import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database.generated";

// One client per request; user context uses public credentials plus SSR cookies.
// Proxy refreshes Server Component sessions. Writable contexts propagate errors.
export async function createServerSupabaseClient(
  responseHeaders: Headers,
  readOnly = false,
) {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.APP_ORIGIN?.startsWith("https:") ??
          process.env.NODE_ENV === "production",
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet, headers) => {
          if (!readOnly) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          }
          // Server Components cannot write cookies; Proxy owns their refresh response.
          Object.entries(headers).forEach(([name, value]) =>
            responseHeaders.set(name, value),
          );
        },
      },
    },
  );
}
