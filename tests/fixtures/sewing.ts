import type { SewingDetail } from "@/modules/sewing/types";
import { pending } from "./verification";
import { verifier } from "./production";
const source = pending();
export const sewing: SewingDetail = {
  id: source.id,
  orderNo: source.orderNo,
  recipeCode: source.recipeCode,
  recipeName: source.recipeName,
  targetQty: source.targetQty,
  status: "VERIFIED",
  revision: 3,
  createdAt: source.createdAt,
  verifiedAt: source.createdAt,
  verifierId: verifier.id,
  verifierName: verifier.fullName,
  actualFabricYards: "94.5",
  expectedFabricYards: "90",
  wastagePct: "5.000000000000",
  wastageCapPct: "5",
  fabricRollId: "ROLL",
  sewingStartedAt: null,
  startedBy: null,
  evidence: {
    id: "94000000-0000-4000-8000-000000000003",
    attemptId: source.currentAttemptId!,
    decision: "APPROVED",
    verifierId: verifier.id,
    verifierName: verifier.fullName,
    createdAt: source.createdAt,
    reason: null,
    actualFabricYards: "94.5",
    expectedFabricYards: "90",
    wastagePct: "5.000000000000",
    items: source.attempts[0]!.items.map((i, index) => ({
      ...i,
      name: source.components[index]!.name,
    })),
  },
};
export const sewingActor = {
  ...verifier,
  id: "93000000-0000-4000-8000-000000000003",
  role: "SEWING_SUPERVISOR" as const,
  fullName: "Sewing Supervisor",
};
