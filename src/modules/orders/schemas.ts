import { z } from "zod";
import { orderStatuses } from "./types";
export const revisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const targetSchema = z
  .number()
  .int()
  .positive("Enter a positive whole garment quantity.")
  .max(2147483647);
export const fabricSchema = z
  .number()
  .positive("Enter positive fabric yards.")
  .lt(1e9)
  .refine(
    (value) => /^\d+(?:\.\d{1,3})?$/.test(String(value)),
    "Use at most three decimal places.",
  );
const preparation = {
  recipeId: z.uuid(),
  targetQty: targetSchema,
  fabricRollId: z.string().trim().min(1, "Enter a fabric roll ID.").max(100),
  actualFabricYards: fabricSchema,
};
export const createOrderSchema = z.strictObject(preparation);
export const editOrderSchema = z
  .strictObject({
    expectedRevision: revisionSchema,
    ...createOrderSchema.partial().shape,
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedRevision"),
    "Enter a preparation change.",
  );
export const expectedRevisionSchema = z.strictObject({
  expectedRevision: revisionSchema,
});
export const idSchema = z.uuid();
export const orderListSchema = z.strictObject({
  status: z.enum(orderStatuses).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-9][0-9]|100)$/)
    .transform(Number)
    .default(20),
  cursor: z.string().max(512).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type EditOrderInput = z.infer<typeof editOrderSchema>;
export type OrderListInput = z.infer<typeof orderListSchema>;
