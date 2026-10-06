import { z } from "zod";
export const loginSchema = z.strictObject({
  email: z
    .email("Enter a valid email address.")
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(128, "Password is too long."),
});
export const demoLoginSchema = z.strictObject({
  persona: z.enum([
    "cutting-supervisor",
    "cutting-verifier",
    "sewing-supervisor",
  ]),
});
export type LoginInput = z.infer<typeof loginSchema>;
