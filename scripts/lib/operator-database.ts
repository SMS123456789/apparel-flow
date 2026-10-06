import "server-only";
import { getPublicEnv } from "@/lib/env/public";
export function operatorDatabaseConnection() {
  const env = getPublicEnv();
  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  const url = new URL(
    process.env.SUPABASE_DB_URL ??
      `postgresql://postgres@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`,
  );
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Invalid SUPABASE_DB_URL protocol");
  }
  const password =
    process.env.SUPABASE_DB_PASSWORD ??
    process.env.db_password ??
    (url.password ? decodeURIComponent(url.password) : undefined);
  if (!password)
    throw new Error(
      "Missing SUPABASE_DB_PASSWORD (legacy db_password supported)",
    );
  // Keep the password out of process arguments and every CLI/error log.
  url.password = "";
  url.searchParams.set("sslmode", "require");
  return {
    url: url.toString(),
    env: {
      ...process.env,
      PGPASSWORD: password,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username) || "postgres",
      PGDATABASE: url.pathname.slice(1) || "postgres",
      PGSSLMODE: "require",
      PGCONNECT_TIMEOUT: "10",
    },
  };
}
