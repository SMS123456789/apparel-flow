import "server-only";

import { z } from "zod";

import { isSecretKey } from "@/lib/env/keys";

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().refine(isSecretKey),
});

export function parseServerEnv(input: unknown) {
  const result = serverEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      "Missing or invalid environment variable: SUPABASE_SECRET_KEY",
    );
  }
  return result.data;
}

export function getServerEnv() {
  return parseServerEnv({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}
