import type { OrderDetail } from "@/modules/orders/types";
import { order } from "./production";
export const attemptId = "94000000-0000-4000-8000-000000000002";
export function pending(
  actual: "GREEN" | "YELLOW" | "RED" | null = "GREEN",
): OrderDetail {
  return {
    ...structuredClone(order),
    status: "PENDING_VERIFICATION",
    revision: 2,
    firstSubmittedAt: order.createdAt,
    currentAttemptId: attemptId,
    attempts: [
      {
        id: attemptId,
        attemptNo: 1,
        status: "OPEN",
        submittedAt: order.createdAt,
        closedAt: null,
        fabricRollId: "ROLL",
        actualFabricYards: "94.5",
        standardFabricYards: "1.8",
        expectedFabricYards: "90",
        wastageCapPct: "5",
        items: order.components.map((c) => ({
          componentId: c.componentId,
          expectedQty: c.expectedQty,
          actualQty:
            actual === null
              ? null
              : c.expectedQty +
                (actual === "YELLOW" ? 1 : actual === "RED" ? -1 : 0),
          status: actual,
        })),
      },
    ],
  };
}
export const decision = { attemptId, expectedRevision: 2 };
