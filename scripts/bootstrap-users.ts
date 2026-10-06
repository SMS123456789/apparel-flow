import "server-only";
import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/public";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseAuthAdminRepository } from "@/server/repositories/auth-repository";
import { SupabaseAdminUserRepository } from "@/server/repositories/admin-user-repository";
import { demoPersonas } from "@/modules/identity/types";
import { operatorDatabaseConnection } from "./lib/operator-database";
nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const credentialSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  fullName: z.string().trim().min(1).max(200),
});
function credentials(prefix: string, fullName: string) {
  const result = credentialSchema.safeParse({
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
    fullName,
  });
  if (!result.success)
    throw new Error(
      `Configure private ${prefix} credentials in the ignored environment.`,
    );
  return result.data;
}
function literal(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
try {
  const env = getPublicEnv();
  const settings = (await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
    {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      cache: "no-store",
    },
  ).then((response) => response.json())) as { disable_signup?: boolean };
  if (!settings.disable_signup)
    throw new Error("Disable public signup in Supabase before provisioning.");
  const adminClient = createAdminSupabaseClient();
  const authAdmin = new SupabaseAuthAdminRepository(adminClient);
  const profiles = new SupabaseAdminUserRepository(adminClient);
  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || data.nextPage)
    throw new Error(
      "Operator account inspection failed or requires pagination; details withheld.",
    );
  const publicClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  async function verify(email: string, password: string) {
    const { error } = await publicClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      throw new Error(
        "Real account authentication failed; credentials withheld, no password reset attempted.",
      );
    await publicClient.auth.signOut({ scope: "local" });
  }
  async function identity(prefix: string, fullName: string) {
    const input = credentials(prefix, fullName);
    const existing = data.users.find(
      (user) => user.email?.toLowerCase() === input.email.toLowerCase(),
    );
    if (existing) await verify(input.email, input.password);
    const user = existing
      ? { id: existing.id, email: input.email }
      : await authAdmin.createUser(input.email, input.password);
    return { user, input, isNew: !existing };
  }
  const admin = await identity(
    "BOOTSTRAP_ADMIN",
    process.env.BOOTSTRAP_ADMIN_FULL_NAME ?? "ApparelFlow Administrator",
  );
  const adminProfile = await profiles.findProfile(admin.user.id);
  if (
    adminProfile &&
    (adminProfile.role !== "SYSTEM_ADMIN" ||
      !adminProfile.isActive ||
      adminProfile.fullName !== admin.input.fullName)
  )
    throw new Error(
      "Existing bootstrap profile differs; operator review required, no overwrite.",
    );
  if (!adminProfile) {
    // Infrastructure-only first admin; no API grants permit this operation.
    const connection = operatorDatabaseConnection();
    const result = spawnSync(
      "psql",
      ["-X", "-w", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      {
        env: connection.env,
        encoding: "utf8",
        timeout: 30000,
        input: `BEGIN;\nSELECT pg_advisory_xact_lock(hashtext('apparelflow_initial_admin'));\nDO $$ BEGIN IF EXISTS(SELECT 1 FROM public.profiles WHERE role='system_admin') THEN RAISE EXCEPTION 'Initial administrator already exists'; END IF; END $$;\nINSERT INTO public.profiles(id,full_name,role,is_active) VALUES (${literal(admin.user.id)}::uuid,${literal(admin.input.fullName)},'system_admin',true);\nINSERT INTO public.admin_audit_events(actor_id,target_user_id,action,after_state,request_id) VALUES(${literal(admin.user.id)}::uuid,${literal(admin.user.id)}::uuid,'USER_CREATED',jsonb_build_object('full_name',${literal(admin.input.fullName)},'role','system_admin','is_active',true),${literal(randomUUID())}::uuid);\nCOMMIT;`,
      },
    );
    if (result.status !== 0) {
      const persisted = await profiles.findProfile(admin.user.id);
      if (admin.isNew && !persisted)
        await authAdmin.deleteIncompleteUser(admin.user.id);
      throw new Error(
        "Initial admin persistence failed; provider details withheld.",
      );
    }
  }
  await verify(admin.input.email, admin.input.password);
  console.log(
    "PASS private initial SYSTEM_ADMIN provisioned/verified; credential withheld.",
  );

  for (const persona of demoPersonas) {
    const account = await identity(persona.env, `Demo ${persona.label}`);
    const profile = await profiles.findProfile(account.user.id);
    if (
      profile &&
      (profile.role !== persona.role ||
        !profile.isActive ||
        profile.fullName !== account.input.fullName)
    )
      throw new Error(
        "Existing demo profile differs; no overwrite or reactivation performed.",
      );
    if (!profile) {
      try {
        await profiles.createProfile(
          admin.user.id,
          account.user.id,
          account.input.fullName,
          persona.role,
          randomUUID(),
        );
      } catch {
        const persisted = await profiles.findProfile(account.user.id);
        if (account.isNew && !persisted)
          await authAdmin.deleteIncompleteUser(account.user.id);
        throw new Error(
          "Demo profile provisioning failed; operator reconciliation required.",
        );
      }
    }
    await verify(account.input.email, account.input.password);
    console.log(`PASS real ${persona.label} account provisioned/verified.`);
  }
  console.log(
    "PASS idempotent operator provisioning; no passwords in SQL, output or source.",
  );
} catch (error) {
  const safe =
    error instanceof Error &&
    /^(Configure private|Disable public signup|Operator account inspection|Existing bootstrap|Existing demo|Initial admin persistence|Real account authentication|Demo profile provisioning)/.test(
      error.message,
    );
  console.error(
    safe
      ? (error as Error).message
      : "User bootstrap failed; operator review required. Provider details withheld.",
  );
  process.exitCode = 1;
}
