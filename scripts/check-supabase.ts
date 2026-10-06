import nextEnv from "@next/env";

import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Development-only diagnostics. Do not print response bodies, keys, or user data.
nextEnv.loadEnvConfig(process.cwd(), true, {
  info: () => {},
  error: () => {},
});

async function checkEndpoint(path: string, accept: string, key: string) {
  const env = getPublicEnv();
  const response = await fetch(new URL(path, env.NEXT_PUBLIC_SUPABASE_URL), {
    method: "GET",
    headers: {
      apikey: key,
      // Legacy JWT API keys double as bearer credentials. New API keys do not.
      ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }),
      Accept: accept,
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  await response.arrayBuffer();
  console.log(`PASS ${path}: HTTP ${response.status}`);
}

try {
  // Validate all configuration before making a request.
  const admin = createAdminSupabaseClient();
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  await checkEndpoint(
    "/auth/v1/health",
    "application/json",
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  // The hosted OpenAPI metadata endpoint requires a privileged API key.
  // This is a trusted diagnostics read, not an application data/RLS bypass.
  await checkEndpoint(
    "/rest/v1/",
    "application/openapi+json",
    serverEnv.SUPABASE_SECRET_KEY,
  );

  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    throw new Error(
      `Privileged Auth read failed (HTTP ${error.status ?? "unknown"})`,
    );
  }
  console.log("PASS privileged Auth API: read-only SDK request");
  console.log(
    "Supabase connectivity verified; no users, records, or schema changed.",
  );
} catch (error) {
  // Only report our controlled messages; provider/network errors may contain data.
  const message = error instanceof Error ? error.message : "";
  const controlled =
    message.startsWith("Missing or invalid environment") ||
    /^\/auth\/v1\/health returned HTTP \d+$/.test(message) ||
    /^\/rest\/v1\/ returned HTTP \d+$/.test(message) ||
    /^Privileged Auth read failed \(HTTP (\d+|unknown)\)$/.test(message);
  console.error(
    `Supabase connectivity failed: ${controlled ? message : "Network or provider failure; check project configuration and availability."}`,
  );
  process.exitCode = 1;
}
