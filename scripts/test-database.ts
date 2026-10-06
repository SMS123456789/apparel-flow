import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

// Isolated disposable PostgreSQL only: no env loading, host ports, or cloud URL.
const containerName = `apparelflow-db-test-${randomUUID()}`;
const context = process.env.DATABASE_TEST_DOCKER_CONTEXT ?? "default";
let started = false;

function docker(args: string[], input?: string) {
  const result = spawnSync("docker", ["--context", context, ...args], {
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
    timeout: 60_000,
  });
  if (result.status !== 0) {
    // This runner only contains isolated synthetic fixtures, never cloud secrets.
    throw new Error(
      `Isolated database command failed: ${result.stderr.trim()}`,
    );
  }
  return result.stdout;
}

function sql(text: string, user = "cloud_operator") {
  docker(
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      user,
      "-d",
      "postgres",
      "-f",
      "-",
    ],
    text,
  );
}

function concurrentSql(
  statement: string,
): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "--context",
        context,
        "exec",
        "-i",
        containerName,
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
        "-U",
        "cloud_operator",
        "-d",
        "postgres",
        "-f",
        "-",
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stderr }));
    child.stdin.end(
      `SET ROLE service_role; BEGIN; ${statement}; SELECT pg_sleep(0.2); COMMIT;`,
    );
  });
}
async function verificationRaces() {
  sql(
    readFileSync("supabase/tests/verification_concurrency_setup.sql", "utf8"),
  );
  const actorA = "'96000000-0000-4000-8000-000000000002'",
    actorB = "'96000000-0000-4000-8000-000000000003'";
  for (const name of [
    "dual-approve",
    "count-approve",
    "reject-approve",
    "dual-start",
  ]) {
    const batch = `(SELECT id FROM public.isolated_race_orders WHERE name='${name}')`,
      attempt = `(SELECT attempt FROM public.isolated_race_orders WHERE name='${name}')`;
    const approve =
      name === "dual-start"
        ? `SELECT public.sewing_start('96000000-0000-4000-8000-000000000004',${batch},3)`
        : `SELECT public.verification_approve(${actorA},${batch},${attempt},2)`;
    const other =
      name === "dual-start"
        ? `SELECT public.sewing_start('96000000-0000-4000-8000-000000000005',${batch},3)`
        : name === "dual-approve"
          ? `SELECT public.verification_approve(${actorB},${batch},${attempt},2)`
          : name === "reject-approve"
            ? `SELECT public.verification_reject(${actorB},${batch},${attempt},2,'Physical defect')`
            : `SELECT public.verification_save(${actorB},${batch},${attempt},2,'[{"componentId":"20000000-0000-4000-8000-000000000001","actualQty":0}]'::jsonb)`;
    const results = await Promise.all([
      concurrentSql(approve),
      concurrentSql(other),
    ]);
    if (
      results.filter((r) => r.status === 0).length !== 1 ||
      !results.some((r) => r.status !== 0 && r.stderr.includes("40001"))
    )
      throw new Error(`Isolated concurrent ${name} did not conflict safely`);
    console.log(
      `PASS real two-session ${name}: one commit, one stale conflict`,
    );
  }
  sql(
    readFileSync("supabase/tests/verification_concurrency_assert.sql", "utf8"),
  );
}

try {
  docker([
    "run",
    "--detach",
    "--rm",
    "--network",
    "none",
    "--name",
    containerName,
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17",
  ]);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = spawnSync(
      "docker",
      [
        "--context",
        context,
        "exec",
        containerName,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    if (result.status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Isolated PostgreSQL did not become ready");
  sql(readFileSync("supabase/tests/bootstrap.sql", "utf8"), "postgres");
  const migrations = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    sql(
      `BEGIN;\n${readFileSync(`supabase/migrations/${name}`, "utf8")}\nCOMMIT;`,
    );
    console.log(`PASS isolated migration: ${name}`);
  }
  sql(
    readFileSync(
      "supabase/migrations/20261006153100_assessment_recipes.sql",
      "utf8",
    ),
  );
  console.log("PASS idempotent assessment seed replay");
  sql(
    `BEGIN READ ONLY;\n${readFileSync("supabase/tests/schema_catalog.sql", "utf8")}\nROLLBACK;`,
  );
  console.log(
    "PASS isolated catalog, constraints, grants, RLS, indexes, enums and exact BOM",
  );
  sql(readFileSync("supabase/tests/domain_constraints.sql", "utf8"));
  console.log(
    "PASS structural constraints, historical immutability and RLS behavior",
  );
  sql(readFileSync("supabase/tests/identity_admin.sql", "utf8"));
  console.log(
    "PASS identity/admin RPC grants, own-profile RLS, atomic audits, role/status/revision guards and rollback",
  );
  sql(readFileSync("supabase/tests/cutting_workflow.sql", "utf8"));
  console.log(
    "PASS cutting command authorization, multipliers, frozen submission, re-cut, RLS and injected rollback",
  );
  sql(readFileSync("supabase/tests/verification_gatekeeper.sql", "utf8"));
  console.log(
    "PASS verification GREEN/YELLOW, hard stops, reasons, identity, immutable re-cut evidence and decision rollback",
  );
  sql(readFileSync("supabase/tests/sewing_workflow.sql", "utf8"));
  console.log(
    "PASS VERIFIED-only sewing/child RLS, frozen labels, role guards and immutable once-only start",
  );
  await verificationRaces();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Isolated database check failed",
  );
  process.exitCode = 1;
} finally {
  if (started) docker(["rm", "--force", containerName]);
}
