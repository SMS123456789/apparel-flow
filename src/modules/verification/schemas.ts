import { z } from "zod";
import { revisionSchema, orderListSchema } from "@/modules/orders/schemas";
export const countSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const decisionSchema = z.strictObject({
  attemptId: z.uuid(),
  expectedRevision: revisionSchema,
});
export const saveCountsSchema = decisionSchema
  .extend({
    items: z
      .array(z.strictObject({ componentId: z.uuid(), actualQty: countSchema }))
      .min(1)
      .max(100),
  })
  .refine(
    (value) =>
      new Set(value.items.map((i) => i.componentId)).size ===
      value.items.length,
    { message: "Each component can appear only once.", path: ["items"] },
  );
export const rejectSchema = decisionSchema.extend({
  reason: z
    .string()
    .trim()
    .min(1, "Enter a meaningful rejection reason.")
    .max(1000, "Use at most 1000 characters."),
});
export const verificationListSchema = orderListSchema.omit({ status: true });
export type DecisionInput = z.infer<typeof decisionSchema>;
export type SaveCountsInput = z.infer<typeof saveCountsSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type VerificationListInput = z.infer<typeof verificationListSchema>;
