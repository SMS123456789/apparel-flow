import { z } from "zod";
import { productionRoles, roles } from "@/modules/identity/types";
export const createUserSchema = z.strictObject({
  email: z
    .email("Enter a valid email address.")
    .max(254)
    .transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(1, "Enter a full name.").max(200),
  role: z.enum(productionRoles),
  temporaryPassword: z
    .string()
    .min(
      6,
      "Use at least 6 characters; the project password policy also applies.",
    )
    .max(128),
});
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const changeRoleSchema = z.strictObject({
  expectedRevision: revision,
  role: z.enum(productionRoles),
});
export const changeStatusSchema = z.strictObject({
  expectedRevision: revision,
  isActive: z.boolean(),
});
export const userIdSchema = z.uuid();
// Query strings are parsed explicitly; command numbers are never coerced.
export const listUsersSchema = z.strictObject({
  search: z.string().trim().max(100).optional(),
  role: z.enum(roles).optional(),
  active: z.enum(["true", "false"]).optional(),
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-9][0-9]|100)$/)
    .transform(Number)
    .default(20),
  cursor: z.string().max(512).optional(),
});
export const listAuditSchema = listUsersSchema.pick({
  limit: true,
  cursor: true,
});
export const cursorSchema = z.strictObject({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type ListAuditInput = z.infer<typeof listAuditSchema>;
