import {
  orderListSchema,
  expectedRevisionSchema,
} from "@/modules/orders/schemas";
import type { z } from "zod";
export const sewingListSchema = orderListSchema.omit({ status: true });
export const startSewingSchema = expectedRevisionSchema;
export type SewingListInput = z.infer<typeof sewingListSchema>;
