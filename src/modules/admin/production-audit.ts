import { z } from "zod";
import type { DecisionEvidence } from "@/modules/orders/types";
import type { PageResult } from "./types";

export const productionAuditSources = [
  "ORDER",
  "SEWING",
  "SUBMISSION",
  "VERIFICATION",
] as const;
const timestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => !/\.\d{7,}/.test(value),
    "Use the timestamp returned by this audit.",
  );
export const productionAuditCursorSchema = z.strictObject({
  time: timestamp,
  source: z.enum(productionAuditSources),
  id: z.uuid(),
});
export const productionAuditListSchema = z.strictObject({
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-9][0-9]|100)$/)
    .transform(Number)
    .default(20),
  cursor: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});
export type ProductionAuditInput = z.infer<typeof productionAuditListSchema>;
export type ProductionAuditCursor = z.infer<typeof productionAuditCursorSchema>;
export interface ProductionAuditEvent extends ProductionAuditCursor {
  orderId: string;
  orderNo: string;
  actorId: string;
  actorName: string;
  actorNameBasis: "decision snapshot" | "current account name" | "unavailable";
  action:
    "ORDER_CREATED" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SEWING_STARTED";
  summary: string;
  attemptId?: string;
  attemptNo?: number;
  recipeName?: string;
  targetQty?: number;
  fabricRollId?: string;
  evidence?: DecisionEvidence;
}
export type ProductionAuditPage = PageResult<ProductionAuditEvent>;

// PostgreSQL keeps microseconds. Date alone would collapse distinct audit times
// into milliseconds and skip records at page boundaries.
function exactTime(value: string) {
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  return `${new Date(value).toISOString().slice(0, 19)}.${fraction.padEnd(6, "0")}Z`;
}
export function compareProductionEvents(
  a: ProductionAuditCursor,
  b: ProductionAuditCursor,
) {
  for (const [left, right] of [
    [exactTime(a.time), exactTime(b.time)],
    [a.source, b.source],
    [a.id, b.id],
  ] as const) {
    if (left !== right) return left > right ? -1 : 1;
  }
  return 0;
}
export function productionCursorFilter(
  source: ProductionAuditCursor["source"],
  column: string,
  cursor: ProductionAuditCursor,
) {
  if (source === cursor.source)
    return `${column}.lt.${cursor.time},and(${column}.eq.${cursor.time},id.lt.${cursor.id})`;
  return `${column}.${source < cursor.source ? "lte" : "lt"}.${cursor.time}`;
}
