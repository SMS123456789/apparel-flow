export const orderStatuses = [
  "CUTTING_IN_PROGRESS",
  "PENDING_VERIFICATION",
  "REJECTED",
  "VERIFIED",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export interface RecipeComponent {
  id: string;
  name: string;
  piecesPerGarment: number;
  sortOrder: number;
  imageUrl: string | null;
}
export interface Recipe {
  id: string;
  code: string;
  name: string;
  category: string;
  standardFabricYards: string;
  wastageCapPct: string;
  components: RecipeComponent[];
}
export interface RequiredComponent {
  componentId: string;
  name: string;
  piecesPerGarment: number;
  expectedQty: number;
  sortOrder: number;
}
export interface CountItem {
  componentId: string;
  expectedQty: number;
  actualQty: number | null;
  status: "GREEN" | "YELLOW" | "RED" | null;
}
export interface Attempt {
  id: string;
  attemptNo: number;
  status: "OPEN" | "APPROVED" | "REJECTED";
  submittedAt: string;
  closedAt: string | null;
  fabricRollId: string;
  actualFabricYards: string;
  standardFabricYards: string;
  expectedFabricYards: string;
  wastageCapPct: string;
  items: CountItem[];
}
export interface DecisionEvidence {
  id: string;
  attemptId: string;
  decision: "APPROVED" | "REJECTED";
  verifierId: string;
  verifierName: string;
  createdAt: string;
  reason: string | null;
  actualFabricYards: string;
  expectedFabricYards: string;
  wastagePct: string;
  items: (CountItem & { name: string })[];
}
export interface OrderSummary {
  id: string;
  orderNo: string;
  recipeName: string;
  recipeCode: string;
  targetQty: number;
  status: OrderStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  sewingStartedAt: string | null;
  startedBy: string | null;
}
export interface OrderDetail extends OrderSummary {
  recipe: Recipe;
  fabricRollId: string;
  actualFabricYards: string;
  expectedFabricYards: string;
  createdBy: string;
  firstSubmittedAt: string | null;
  currentAttemptId: string | null;
  approvedLogId: string | null;
  components: RequiredComponent[];
  attempts: Attempt[];
  evidence: DecisionEvidence[];
}
export interface OrderPage {
  items: OrderSummary[];
  nextCursor: string | null;
}
