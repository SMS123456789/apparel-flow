import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database.generated";

// One client per request; user context uses public credentials plus SSR cookies.
// Call from writable Route Handler/Server Action contexts. Read-only rendering
// and refresh proxy integration belong to G05; cookie-write errors stay visible.
export async function createServerSupabaseClient(responseHeaders: Headers) {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) =>
            responseHeaders.set(name, value),
          );
        },
      },
    },
  );
}
