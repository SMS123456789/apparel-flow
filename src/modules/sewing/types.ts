import type { DecisionEvidence } from "@/modules/orders/types";
export interface SewingBatch {
  id: string;
  orderNo: string;
  recipeCode: string;
  recipeName: string;
  targetQty: number;
  status: "VERIFIED";
  revision: number;
  createdAt: string;
  verifiedAt: string;
  verifierId: string;
  verifierName: string;
  actualFabricYards: string;
  expectedFabricYards: string;
  wastagePct: string;
  wastageCapPct: string;
  fabricRollId: string;
  sewingStartedAt: string | null;
  startedBy: string | null;
}
export interface SewingDetail extends SewingBatch {
  evidence: DecisionEvidence;
}
export interface SewingPage {
  items: SewingBatch[];
  nextCursor: string | null;
}
