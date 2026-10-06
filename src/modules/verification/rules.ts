import type { CountItem, RequiredComponent } from "@/modules/orders/types";
import { fabricThousandths } from "@/modules/orders/calculations";
export interface GateViolation {
  componentId?: string;
  reason: "MISSING_COMPONENT" | "UNCOUNTED" | "SHORTAGE";
}
export function componentResult(
  expected: number,
  actual: number | null,
): "GREEN" | "YELLOW" | "RED" | null {
  return actual === null
    ? null
    : actual === expected
      ? "GREEN"
      : actual > expected
        ? "YELLOW"
        : "RED";
}
export function approvalViolations(
  manifest: RequiredComponent[],
  items: CountItem[],
): GateViolation[] {
  const result: GateViolation[] = [];
  if (!manifest.length) result.push({ reason: "MISSING_COMPONENT" });
  const grouped = new Map<string, CountItem[]>();
  for (const i of items) {
    grouped.set(i.componentId, [...(grouped.get(i.componentId) ?? []), i]);
  }
  for (const c of manifest) {
    const rows = grouped.get(c.componentId);
    const i = rows?.[0];
    if (
      rows?.length !== 1 ||
      !i ||
      i.expectedQty !== c.expectedQty ||
      !Number.isSafeInteger(c.expectedQty) ||
      c.expectedQty <= 0
    )
      result.push({ componentId: c.componentId, reason: "MISSING_COMPONENT" });
    else if (i.actualQty === null)
      result.push({ componentId: c.componentId, reason: "UNCOUNTED" });
    else if (!Number.isSafeInteger(i.actualQty) || i.actualQty < 0)
      result.push({ componentId: c.componentId, reason: "MISSING_COMPONENT" });
    else if (i.actualQty < c.expectedQty)
      result.push({ componentId: c.componentId, reason: "SHORTAGE" });
  }
  for (const i of items)
    if (!manifest.some((c) => c.componentId === i.componentId))
      result.push({ componentId: i.componentId, reason: "MISSING_COMPONENT" });
  return result;
}
export function wastagePercentage(
  actualYards: string,
  expectedYards: string,
): string {
  const actual = fabricThousandths(actualYards),
    expected = fabricThousandths(expectedYards);
  if (expected <= BigInt(0))
    throw new Error("Positive expected fabric required");
  const diff = actual - expected,
    negative = diff < BigInt(0);
  const scale = BigInt("1000000000000");
  const numerator = (negative ? -diff : diff) * BigInt(100) * scale;
  let rounded = numerator / expected;
  if ((numerator % expected) * BigInt(2) >= expected) rounded += BigInt(1);
  const whole = rounded / scale,
    fraction = (rounded % scale)
      .toString()
      .padStart(12, "0")
      .replace(/0+$/, "");
  return `${negative && rounded !== BigInt(0) ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}
