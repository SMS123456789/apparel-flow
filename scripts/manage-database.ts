import "server-only";

import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { format, resolveConfig } from "prettier";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";

import { operatorDatabaseConnection } from "./lib/operator-database";

// Operator tooling only. Application clients never use a Postgres password.
nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: string,
) {
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
    timeout: 120_000,
  });
  if (result.status !== 0) {
    const output = (result.stderr ?? "").toLowerCase();
    const cause = output.includes("docker")
      ? "Docker unavailable"
      : output.includes("password authentication failed")
        ? "database authentication failed"
        : output.includes("timeout")
          ? "connection/query timed out"
          : output.includes("certificate")
            ? "TLS certificate validation failed"
            : "database/CLI operation failed";
    throw new Error(
      `${cause}; exit ${result.status ?? "unavailable"}. Provider output withheld.`,
    );
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

try {
  const mode = process.argv[2];
  if (!["list", "plan", "push", "verify", "types"].includes(mode ?? "")) {
    throw new Error(
      "Expected database tooling mode: list, plan, push, verify, types",
    );
  }
  const connection = operatorDatabaseConnection();
  if (mode === "verify") {
    const expectedVersions = readdirSync("supabase/migrations")
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .map((name) => name.slice(0, 14))
      .sort();
    const history = run(
      "psql",
      [
        "-X",
        "-w",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;",
      ],
      connection.env,
    )
      .stdout.trim()
      .split(/\r?\n/)
      .filter(Boolean);
    if (history.join(",") !== expectedVersions.join(",")) {
      throw new Error(
        "Remote migration history differs from local SQL; reconcile before proceeding",
      );
    }
    run(
      "psql",
      ["-X", "-w", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      connection.env,
      `BEGIN READ ONLY;\n${readFileSync("supabase/tests/schema_catalog.sql", "utf8")}\nROLLBACK;`,
    );
    const summary = run(
      "psql",
      [
        "-X",
        "-w",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `
      SELECT json_build_object(
        'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
        'enums', (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'),
        'foreign_keys', (SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace WHERE n.nspname = 'public' AND k.contype = 'f'),
        'checks', (SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace WHERE n.nspname = 'public' AND k.contype = 'c'),
        'indexes', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'),
        'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public'),
        'admin_gateways', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('admin_list_users','admin_create_profile','admin_update_profile','admin_list_audit')),
        'triggers', (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal),
        'recipes', (SELECT count(*) FROM public.recipes),
        'recipe_components', (SELECT count(*) FROM public.recipe_components),
        'auth_users', (SELECT count(*) FROM auth.users),
        'profiles', (SELECT count(*) FROM public.profiles),
        'cutting_orders', (SELECT count(*) FROM public.cutting_orders),
        'verification_attempts', (SELECT count(*) FROM public.verification_attempts),
        'verification_logs', (SELECT count(*) FROM public.verification_logs),
        'admin_audit_events', (SELECT count(*) FROM public.admin_audit_events)
      );`,
      ],
      connection.env,
    );
    console.log(
      "PASS remote catalog, constraints, enums, indexes, scoped identity/production default-deny RLS/grants, private triggers and exact recipes",
    );
    console.log(
      `PASS remote migration history matches local SQL: ${history.join(", ")}`,
    );
    console.log(summary.stdout.trim());
  } else if (mode === "types") {
    const { stdout: output } = run(
      "node_modules/.bin/supabase",
      [
        "gen",
        "types",
        "typescript",
        "--db-url",
        connection.url,
        "--schema",
        "public",
      ],
      connection.env,
    );
    if (
      !output.includes("export type Database") ||
      !output.includes("verification_log_items") ||
      !output.includes("admin_audit_events")
    ) {
      throw new Error(
        "Type generation did not return the established schema; existing types preserved",
      );
    }
    const secretValues = [
      connection.env.PGPASSWORD,
      process.env.SUPABASE_SECRET_KEY,
    ].filter((value): value is string => Boolean(value));
    if (secretValues.some((value) => output.includes(value)))
      throw new Error(
        "Unexpected credential in generated output; file not written",
      );
    mkdirSync("src/types", { recursive: true });
    const target = "src/types/database.generated.ts";
    // Automatic formatting only; generated definitions are never hand-edited.
    const formatted = await format(output, {
      ...(await resolveConfig(target)),
      filepath: target,
    });
    writeFileSync(`${target}.tmp`, formatted);
    renameSync(`${target}.tmp`, target);
    console.log(
      `PASS Supabase CLI generated ${target}; automatically formatted without definition edits`,
    );
  } else {
    const args =
      mode === "list"
        ? ["migration", "list"]
        : [
            "db",
            "push",
            "--skip-vault",
            ...(mode === "plan" ? ["--dry-run"] : ["--yes"]),
          ];
    const output = run(
      "node_modules/.bin/supabase",
      [...args, "--db-url", connection.url],
      connection.env,
    );
    // Only local migration names/status are emitted, never provider output.
    const metadata = `${output.stdout}\n${output.stderr}`;
    const versions = readdirSync("supabase/migrations")
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .map((name) => name.slice(0, 14))
      .filter((version) => metadata.includes(version))
      .sort();
    console.log(
      `PASS remote migration ${mode}; versions: ${versions.join(", ") || "none"}`,
    );
  }
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Database tooling failed";
  const controlled =
    /^(Missing SUPABASE_DB_PASSWORD|Invalid SUPABASE_DB_URL protocol|Expected database tooling mode|Docker unavailable|database authentication failed|connection\/query timed out|TLS certificate validation failed|database\/CLI operation failed|Type generation did not return|Unexpected credential in generated output|Missing or invalid environment|Remote migration history differs)/.test(
      message,
    );
  console.error(
    controlled
      ? message
      : "Database tooling failed; check operator configuration. Details withheld.",
  );
  process.exitCode = 1;
}
