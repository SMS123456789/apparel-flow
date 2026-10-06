import nextEnv from "@next/env";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), false, {
  info: () => {},
  error: () => {},
});
const privateNames = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_PASSWORD",
  "db_password",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "DEMO_CUTTING_SUPERVISOR_PASSWORD",
  "DEMO_CUTTING_VERIFIER_PASSWORD",
  "DEMO_SEWING_SUPERVISOR_PASSWORD",
];
const privateValues = privateNames
  .map((name) => process.env[name])
  .filter((value): value is string => Boolean(value && value.length >= 6));
function javascriptFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? javascriptFiles(`${path}/${entry.name}`)
      : entry.name.endsWith(".js")
        ? [`${path}/${entry.name}`]
        : [],
  );
}
try {
  const inventory = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  if (inventory.status !== 0) throw new Error("Inventory unavailable");
  const files = inventory.stdout.trim().split("\n");
  const generated = javascriptFiles(".next");
  for (const file of new Set([...files, ...generated])) {
    const text = readFileSync(file, "utf8");
    if (privateValues.some((value) => text.includes(value)))
      throw new Error("Credential content found");
  }
  const browser = javascriptFiles(".next/static");
  for (const file of browser) {
    if (
      /SUPABASE_SECRET_KEY|BOOTSTRAP_ADMIN_|DEMO_(?:CUTTING_SUPERVISOR|CUTTING_VERIFIER|SEWING_SUPERVISOR)_PASSWORD/.test(
        readFileSync(file, "utf8"),
      )
    )
      throw new Error("Private configuration in browser code");
  }
  const ignored = spawnSync("git", ["check-ignore", ".env", ".env.local"], {
    encoding: "utf8",
  });
  if (ignored.status !== 0) throw new Error("Private environment not ignored");
  console.log(
    `PASS private-value scan: ${privateValues.length} configured values, ${files.length} repository files, ${generated.length} generated JS files, ${browser.length} browser files; environment files ignored.`,
  );
} catch {
  console.error(
    "FAIL private-value audit; inspect configuration and generated files privately. Values withheld.",
  );
  process.exitCode = 1;
}
