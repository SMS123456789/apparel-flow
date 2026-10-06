import { z } from "zod";

import { isPublishableKey } from "@/lib/env/keys";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine((value) => {
    try {
      const url = new URL(value);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname,
      );
      return (
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        (url.protocol === "https:" || (url.protocol === "http:" && loopback))
      );
    } catch {
      return false;
    }
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().refine(isPublishableKey),
});

export function parsePublicEnv(input: unknown) {
  const result = publicEnvSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(
      `Missing or invalid environment variables: ${fields.join(", ")}`,
    );
  }
  // Zod strips unrelated fields, including privileged credentials.
  return result.data;
}

export function getPublicEnv() {
  // Explicit accesses are required for Next.js public-variable inlining.
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
